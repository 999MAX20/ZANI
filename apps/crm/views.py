from django.utils import timezone
from django.db.models import Count, Prefetch, Q, Sum
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.activities.services import write_activity_event
from apps.businesses.models import Business
from apps.core.crm_cards import deal_crm_card
from apps.core.permissions import user_can_access_business
from apps.core.viewsets import TenantModelViewSet
from apps.crm.models import Deal, Pipeline, PipelineStage, StageTransition
from apps.crm.serializers import DealListSerializer, DealSerializer, PipelineSerializer, PipelineStageSerializer, StageTransitionSerializer
from apps.tasks.models import Task


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


class DealPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class DealViewSet(TenantModelViewSet):
    queryset = Deal.objects.select_related("business", "client", "lead", "pipeline", "stage", "owner")
    serializer_class = DealSerializer
    pagination_class = DealPagination

    def get_serializer_class(self):
        if self.action in {"list", "board"}:
            return DealListSerializer
        return DealSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, dict):
            base_queryset = self.filter_queryset(self.get_queryset())
            response.data["facets"] = self._build_facets(base_queryset)
        return response

    def get_queryset(self):
        queryset = super().get_queryset().prefetch_related(
            Prefetch(
                "tasks",
                queryset=Task.objects.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED]).order_by("due_at", "-created_at"),
                to_attr="open_tasks_for_list",
            )
        )
        params = self.request.query_params
        client_ids = self.parse_query_id_list("client_ids")
        if client_ids:
            queryset = queryset.filter(client_id__in=client_ids)
        pipeline = params.get("pipeline")
        if pipeline:
            queryset = queryset.filter(pipeline_id=pipeline)
        stage = params.get("stage")
        if stage:
            queryset = queryset.filter(stage_id=stage)
        statuses = self.parse_query_list("statuses") or self.parse_query_list("status")
        if statuses:
            queryset = queryset.filter(status__in=statuses)
        owner = params.get("owner")
        if owner:
            queryset = queryset.filter(owner_id=owner)
        if params.get("unassigned") == "true":
            queryset = queryset.filter(owner__isnull=True)
        if params.get("mine") == "true":
            queryset = queryset.filter(owner=self.request.user)
        source = params.get("source")
        if source:
            queryset = queryset.filter(source=source)
        search = (params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(source__icontains=search)
                | Q(client__full_name__icontains=search)
                | Q(client__phone__icontains=search)
                | Q(client__email__icontains=search)
            )
        amount_min = params.get("amount_min") or params.get("min")
        if amount_min not in (None, ""):
            queryset = queryset.filter(amount__gte=amount_min)
        amount_max = params.get("amount_max") or params.get("max")
        if amount_max not in (None, ""):
            queryset = queryset.filter(amount__lte=amount_max)
        created_from = params.get("created_from") or params.get("from")
        if created_from:
            queryset = queryset.filter(created_at__date__gte=created_from)
        created_to = params.get("created_to") or params.get("to")
        if created_to:
            queryset = queryset.filter(created_at__date__lte=created_to)
        expected_close_from = params.get("expected_close_from")
        if expected_close_from:
            queryset = queryset.filter(expected_close_at__gte=expected_close_from)
        expected_close_to = params.get("expected_close_to")
        if expected_close_to:
            queryset = queryset.filter(expected_close_at__lte=expected_close_to)
        quick = params.get("quick")
        if quick == "overdue":
            now = timezone.now()
            queryset = queryset.filter(stage__sla_minutes__isnull=False, stage_entered_at__lt=now - timezone.timedelta(minutes=1))
        elif quick == "no_tasks":
            queryset = queryset.filter(status=Deal.Statuses.OPEN, next_action_at__isnull=True).exclude(
                tasks__status__in=[Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS]
            )
        elif quick == "hot":
            queryset = queryset.filter(
                Q(expected_close_at__lt=timezone.now().date())
                | (Q(status=Deal.Statuses.OPEN) & Q(next_action_at__isnull=True) & ~Q(tasks__status__in=[Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS]))
            )

        ordering = params.get("ordering")
        allowed_ordering = {
            "updated_at",
            "-updated_at",
            "created_at",
            "-created_at",
            "amount",
            "-amount",
            "expected_close_at",
            "-expected_close_at",
            "stage__order",
            "-stage__order",
        }
        if ordering in allowed_ordering:
            queryset = queryset.order_by(ordering, "-updated_at")
        return queryset

    def _build_facets(self, queryset):
        return {
            "status": {item["status"]: item["count"] for item in queryset.values("status").annotate(count=Count("id", distinct=True))},
            "source": {item["source"] or "manual": item["count"] for item in queryset.values("source").annotate(count=Count("id", distinct=True))},
            "stage": {str(item["stage"]): item["count"] for item in queryset.values("stage").annotate(count=Count("id", distinct=True))},
        }

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

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self._filtered_for_analytics()
        open_deals = queryset.filter(status=Deal.Statuses.OPEN)
        won_deals = queryset.filter(status=Deal.Statuses.WON)
        lost_deals = queryset.filter(status=Deal.Statuses.LOST)
        no_task_deals = open_deals.filter(next_action_at__isnull=True).exclude(tasks__status__in=[Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS])
        hot_deals = open_deals.filter(
            Q(expected_close_at__lt=timezone.now().date())
            | (Q(next_action_at__isnull=True) & ~Q(tasks__status__in=[Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS]))
        )
        by_status = {item["status"]: item["count"] for item in queryset.values("status").annotate(count=Count("id", distinct=True))}
        by_source = {item["source"] or "manual": item["count"] for item in queryset.values("source").annotate(count=Count("id", distinct=True))}
        by_stage = {str(item["stage"]): item["count"] for item in queryset.values("stage").annotate(count=Count("id", distinct=True))}
        return Response(
            {
                "total": queryset.count(),
                "open": open_deals.count(),
                "won": won_deals.count(),
                "lost": lost_deals.count(),
                "pipeline_value": str(open_deals.aggregate(value=Sum("amount"))["value"] or 0),
                "expected_revenue": str(sum(float(deal.amount or 0) * ((deal.probability or getattr(deal.stage, "probability", 0) or 0) / 100) for deal in open_deals)),
                "overdue": self._overdue_queryset(open_deals).count(),
                "no_tasks": no_task_deals.distinct().count(),
                "hot": hot_deals.distinct().count(),
                "mine": queryset.filter(owner=request.user).count(),
                "by_status": by_status,
                "by_source": by_source,
                "by_stage": by_stage,
            }
        )

    @action(detail=False, methods=["get"])
    def board(self, request):
        queryset = self.get_queryset()
        pipeline_id = request.query_params.get("pipeline")
        if pipeline_id:
            stages = PipelineStage.objects.filter(pipeline_id=pipeline_id, business__in=queryset.values("business")).order_by("order", "name")
        else:
            first_pipeline = queryset.values_list("pipeline_id", flat=True).first()
            stages = PipelineStage.objects.filter(pipeline_id=first_pipeline).order_by("order", "name") if first_pipeline else PipelineStage.objects.none()
        try:
            limit = min(max(int(request.query_params.get("limit_per_stage", 10)), 1), 50)
            offset = max(int(request.query_params.get("offset", 0)), 0)
        except ValueError:
            limit = 10
            offset = 0

        serializer_class = self.get_serializer_class()
        payload = []
        for stage in stages:
            stage_queryset = queryset.filter(stage=stage).order_by("-updated_at", "-id")
            total = stage_queryset.count()
            deals = stage_queryset[offset : offset + limit]
            payload.append(
                {
                    **PipelineStageSerializer(stage).data,
                    "count": total,
                    "offset": offset,
                    "limit": limit,
                    "has_more": total > offset + limit,
                    "deals": serializer_class(deals, many=True, context={"request": request}).data,
                }
            )
        return Response({"stages": payload})

    def _filtered_for_analytics(self):
        params = self.request.query_params.copy()
        params.pop("quick", None)
        original = self.request._request.GET
        self.request._request.GET = params
        try:
            return self.get_queryset()
        finally:
            self.request._request.GET = original

    def _overdue_queryset(self, queryset):
        overdue_ids = []
        now = timezone.now()
        for deal in queryset.filter(stage__sla_minutes__isnull=False, stage_entered_at__isnull=False).select_related("stage"):
            if deal.stage_entered_at and deal.stage and deal.stage.sla_minutes and now > deal.stage_entered_at + timezone.timedelta(minutes=deal.stage.sla_minutes):
                overdue_ids.append(deal.id)
        return queryset.filter(id__in=overdue_ids)


class StageTransitionViewSet(TenantModelViewSet):
    queryset = StageTransition.objects.select_related("business", "pipeline", "from_stage", "to_stage")
    serializer_class = StageTransitionSerializer
