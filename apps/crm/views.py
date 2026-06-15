from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.activities.services import write_activity_event
from apps.businesses.models import Business
from apps.core.crm_cards import deal_crm_card
from apps.core.permissions import user_can_access_business
from apps.core.viewsets import TenantModelViewSet
from apps.crm.models import Deal, Pipeline, PipelineStage, StageTransition
from apps.crm.serializers import DealSerializer, PipelineSerializer, PipelineStageSerializer, StageTransitionSerializer


class PipelineViewSet(TenantModelViewSet):
    queryset = Pipeline.objects.prefetch_related("stages").select_related("business")
    serializer_class = PipelineSerializer

    @action(detail=True, methods=["get"])
    def board(self, request, pk=None):
        pipeline = self.get_object()
        stages = pipeline.stages.all().order_by("order", "name")
        deals = Deal.objects.filter(business=pipeline.business, pipeline=pipeline).select_related("business", "client", "lead", "pipeline", "stage", "owner")
        return Response(
            {
                "pipeline": PipelineSerializer(pipeline).data,
                "stages": [
                    {
                        **PipelineStageSerializer(stage).data,
                        "deals": DealSerializer([deal for deal in deals if deal.stage_id == stage.id], many=True).data,
                    }
                    for stage in stages
                ],
            }
        )

    @action(detail=False, methods=["post"], url_path="templates/apply")
    def apply_template(self, request):
        business_id = request.data.get("business")
        template_key = request.data.get("template_key", "sales_basic")
        business = Business.objects.filter(id=business_id).first()
        if not business or not user_can_access_business(request.user, business):
            raise ValidationError({"business": "Business is not available."})

        pipeline = Pipeline.objects.create(
            business=business,
            name=request.data.get("name") or "Sales Pipeline",
            slug=request.data.get("slug") or f"sales-{Pipeline.objects.filter(business=business).count() + 1}",
            is_default=not Pipeline.objects.filter(business=business).exists(),
            template_key=template_key,
        )
        stage_specs = [
            ("Новая", "#2563eb", 10, 240, {}),
            ("В работе", "#06b6d4", 35, 480, {"fields": ["amount"]}),
            ("Предложение", "#8b5cf6", 65, 1440, {"fields": ["amount", "next_action_at"]}),
            ("Выиграна", "#16a34a", 100, None, {"fields": ["amount"]}),
            ("Потеряна", "#ef4444", 0, None, {"fields": ["lost_reason"]}),
        ]
        for order, (name, color, probability, sla_minutes, required_fields) in enumerate(stage_specs, start=1):
            PipelineStage.objects.create(
                business=business,
                pipeline=pipeline,
                name=name,
                order=order,
                color=color,
                probability=probability,
                sla_minutes=sla_minutes,
                required_fields_json=required_fields,
                is_won=name == "Выиграна",
                is_lost=name == "Потеряна",
            )
        return Response(PipelineSerializer(pipeline).data, status=201)


class PipelineStageViewSet(TenantModelViewSet):
    queryset = PipelineStage.objects.select_related("business", "pipeline")
    serializer_class = PipelineStageSerializer


class DealViewSet(TenantModelViewSet):
    queryset = Deal.objects.select_related("business", "client", "lead", "pipeline", "stage", "owner")
    serializer_class = DealSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        client_ids = self.parse_query_id_list("client_ids")
        if client_ids:
            queryset = queryset.filter(client_id__in=client_ids)
        return queryset

    def perform_create(self, serializer):
        serializer.validated_data.setdefault("stage_entered_at", timezone.now())
        super().perform_create(serializer)

    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        previous_stage = serializer.instance.stage
        if serializer.validated_data.get("status") == Deal.Statuses.LOST:
            lost_reason = serializer.validated_data.get("lost_reason") or serializer.instance.lost_reason
            if not lost_reason:
                raise ValidationError({"lost_reason": "Reason is required when deal is lost."})
            serializer.validated_data.setdefault("previous_status", previous_status)
            serializer.validated_data.setdefault("previous_stage", previous_stage)
            serializer.validated_data.setdefault("lost_at", timezone.now())
            serializer.validated_data.setdefault("lost_by", self.request.user)
        super().perform_update(serializer)

    @action(detail=True, methods=["post"], url_path="move-stage")
    def move_stage(self, request, pk=None):
        deal = self.get_object()
        stage_id = request.data.get("stage")
        if not stage_id:
            raise ValidationError({"stage": "This field is required."})
        try:
            stage = PipelineStage.objects.get(id=stage_id, business=deal.business, pipeline=deal.pipeline)
        except PipelineStage.DoesNotExist as exc:
            raise ValidationError({"stage": "Stage does not exist in this deal pipeline."}) from exc
        self._validate_transition(deal, stage, request)
        return self._apply_stage(deal=deal, stage=stage, request=request)

    @action(detail=True, methods=["post"], url_path="mark-won")
    def mark_won(self, request, pk=None):
        deal = self.get_object()
        stage = self._get_terminal_stage(deal, is_won=True)
        if request.data.get("amount") not in (None, ""):
            deal.amount = request.data.get("amount")
        return self._apply_stage(deal=deal, stage=stage, request=request, event_type="deal_marked_won", activity_text="Сделка отмечена как оплаченная/успешная")

    @action(detail=True, methods=["post"], url_path="mark-lost")
    def mark_lost(self, request, pk=None):
        deal = self.get_object()
        stage = self._get_terminal_stage(deal, is_lost=True)
        lost_reason = (request.data.get("lost_reason") or "").strip()
        if not lost_reason:
            raise ValidationError({"lost_reason": "Reason is required when deal is lost."})
        return self._apply_stage(deal=deal, stage=stage, request=request, event_type="deal_marked_lost", activity_text="Сделка закрыта как отказ", lost_reason=lost_reason)

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, pk=None):
        deal = self.get_object()
        stage = self._get_reopen_stage(deal)
        return self._apply_stage(deal=deal, stage=stage, request=request, event_type="deal_reopened", activity_text="Сделка возвращена в работу")

    def _apply_stage(self, *, deal, stage, request, event_type="deal_stage_changed", activity_text=None, lost_reason=None):
        previous_status = deal.status
        previous_stage = deal.stage
        now = timezone.now()

        deal.stage = stage
        deal.probability = stage.probability
        deal.stage_entered_at = now
        if stage.is_won:
            deal.status = Deal.Statuses.WON
            deal.won_at = deal.won_at or now
            deal.lost_at = None
            deal.lost_by = None
            deal.previous_status = previous_status if previous_status != Deal.Statuses.WON else ""
            deal.previous_stage = previous_stage if getattr(previous_stage, "id", None) else None
            deal.lost_reason = ""
        elif stage.is_lost:
            deal.status = Deal.Statuses.LOST
            deal.lost_at = deal.lost_at or now
            deal.lost_by = request.user
            deal.previous_status = previous_status if previous_status != Deal.Statuses.LOST else ""
            deal.previous_stage = previous_stage if getattr(previous_stage, "id", None) else None
            deal.won_at = None
            deal.lost_reason = lost_reason if lost_reason is not None else request.data.get("lost_reason", deal.lost_reason)
        else:
            deal.status = Deal.Statuses.OPEN
            deal.won_at = None
            deal.lost_at = None
            deal.lost_by = None
            deal.previous_status = ""
            deal.previous_stage = None
            deal.lost_reason = ""
        deal.save(update_fields=["stage", "probability", "stage_entered_at", "status", "amount", "won_at", "lost_at", "lost_by", "lost_reason", "previous_status", "previous_stage", "updated_at"])
        write_activity_event(request, event_type, deal, text=activity_text or f"Сделка перешла на стадию: {stage.name}")
        return Response(DealSerializer(deal).data)

    def _get_terminal_stage(self, deal, *, is_won=False, is_lost=False):
        query = PipelineStage.objects.filter(business=deal.business, pipeline=deal.pipeline)
        if is_won:
            query = query.filter(is_won=True)
        if is_lost:
            query = query.filter(is_lost=True)
        stage = query.order_by("order", "id").first()
        if not stage:
            raise ValidationError({"stage": "Terminal stage is not configured for this pipeline."})
        return stage

    def _get_reopen_stage(self, deal):
        if deal.previous_stage_id and not (deal.previous_stage.is_won or deal.previous_stage.is_lost):
            return deal.previous_stage
        stage = PipelineStage.objects.filter(
            business=deal.business,
            pipeline=deal.pipeline,
            is_won=False,
            is_lost=False,
        ).order_by("order", "id").first()
        if not stage:
            raise ValidationError({"stage": "Open stage is not configured for this pipeline."})
        return stage

    def _validate_transition(self, deal, stage, request):
        transition = StageTransition.objects.filter(
            business=deal.business,
            pipeline=deal.pipeline,
            from_stage=deal.stage,
            to_stage=stage,
            is_active=True,
        ).first()
        if transition and transition.required_permission:
            allowed_roles = set(stage.allowed_roles_json.get("roles", []))
            if allowed_roles and request.user.role not in allowed_roles:
                raise ValidationError({"stage": "Your role cannot move deals to this stage."})

        allowed_roles = set(stage.allowed_roles_json.get("roles", []))
        if allowed_roles and request.user.role not in allowed_roles:
            raise ValidationError({"stage": "Your role cannot move deals to this stage."})

        missing = []
        for field in stage.required_fields_json.get("fields", []):
            value = request.data.get(field, getattr(deal, field, None))
            if value in (None, "", 0, "0"):
                missing.append(field)
        if stage.is_lost and not (request.data.get("lost_reason") or deal.lost_reason):
            missing.append("lost_reason")
        if missing:
            raise ValidationError({"required_fields": missing})

    @action(detail=True, methods=["get"], url_path="crm-card")
    def crm_card(self, request, pk=None):
        deal = self.get_object()
        return Response(deal_crm_card(deal))


class StageTransitionViewSet(TenantModelViewSet):
    queryset = StageTransition.objects.select_related("business", "pipeline", "from_stage", "to_stage")
    serializer_class = StageTransitionSerializer
