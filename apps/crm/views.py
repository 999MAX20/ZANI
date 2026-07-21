from django.utils import timezone
from django.db.models import Count, Prefetch, Q
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.businesses.access import Actions, Resources, assert_can
from apps.businesses.models import Business
from apps.core.crm_cards import deal_crm_card
from apps.core.permissions import user_can_access_business
from apps.core.viewsets import TenantModelViewSet
from apps.core.work_queues import no_next_action_deals_queryset, sla_overdue_deals_queryset
from apps.crm.models import Deal, Pipeline, PipelineStage, StageTransition
from apps.crm.selectors import build_deal_summary, stale_deals_queryset
from apps.crm.serializers import DealListSerializer, DealSerializer, PipelineSerializer, PipelineStageSerializer, StageTransitionSerializer
from apps.crm.services import mark_deal_lost, mark_deal_won, move_deal_stage, record_deal_value_change, reopen_deal
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
                queryset=Task.objects.filter(is_archived=False).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED]).order_by("due_at", "-created_at"),
                to_attr="open_tasks_for_list",
            )
        )
        params = self.request.query_params
        client_ids = self.parse_query_id_list("client_ids")
        if client_ids:
            queryset = queryset.filter(client_id__in=client_ids)
        lead_ids = self.parse_query_id_list("lead_ids")
        if lead_ids:
            queryset = queryset.filter(lead_id__in=lead_ids)
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
            queryset = self._overdue_queryset(queryset.filter(status=Deal.Statuses.OPEN))
        elif quick == "no_tasks":
            queryset = no_next_action_deals_queryset(queryset.filter(status=Deal.Statuses.OPEN))
        elif quick == "hot":
            queryset = stale_deals_queryset(queryset)

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
        queryset = queryset.order_by()
        return {
            "status": {item["status"]: item["count"] for item in queryset.values("status").annotate(count=Count("id", distinct=True))},
            "source": {item["source"] or "manual": item["count"] for item in queryset.values("source").annotate(count=Count("id", distinct=True))},
            "stage": {str(item["stage"]): item["count"] for item in queryset.values("stage").annotate(count=Count("id", distinct=True))},
        }

    def perform_create(self, serializer):
        serializer.validated_data.setdefault("stage_entered_at", timezone.now())
        super().perform_create(serializer)

    def perform_update(self, serializer):
        previous_amount = serializer.instance.amount
        previous_currency = serializer.instance.currency
        super().perform_update(serializer)
        record_deal_value_change(
            deal=serializer.instance,
            previous_amount=previous_amount,
            previous_currency=previous_currency,
            actor=self.request.user,
            request=self.request,
            metadata={"reason": "deal_update"},
        )

    def _legacy_perform_update_disabled(self, serializer):
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
        assert_can(request.user, deal.business, Resources.DEALS, Actions.UPDATE, obj=deal)
        stage_id = request.data.get("stage")
        if not stage_id:
            raise ValidationError({"stage": "This field is required."})
        try:
            stage = PipelineStage.objects.get(id=stage_id, business=deal.business, pipeline=deal.pipeline)
        except PipelineStage.DoesNotExist as exc:
            raise ValidationError({"stage": "Stage does not exist in this deal pipeline."}) from exc
        deal = move_deal_stage(deal=deal, stage=stage, actor=request.user, payload=request.data, request=request)
        return Response(DealSerializer(deal, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="mark-won")
    def mark_won(self, request, pk=None):
        deal = self.get_object()
        assert_can(request.user, deal.business, Resources.DEALS, Actions.UPDATE, obj=deal)
        deal = mark_deal_won(deal=deal, actor=request.user, amount=request.data.get("amount"), request=request)
        return Response(DealSerializer(deal, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="mark-lost")
    def mark_lost(self, request, pk=None):
        deal = self.get_object()
        assert_can(request.user, deal.business, Resources.DEALS, Actions.UPDATE, obj=deal)
        deal = mark_deal_lost(deal=deal, actor=request.user, lost_reason=request.data.get("lost_reason", ""), request=request)
        return Response(DealSerializer(deal, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, pk=None):
        deal = self.get_object()
        assert_can(request.user, deal.business, Resources.DEALS, Actions.UPDATE, obj=deal)
        deal = reopen_deal(deal=deal, actor=request.user, request=request)
        return Response(DealSerializer(deal, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="crm-card")
    def crm_card(self, request, pk=None):
        deal = self.get_object()
        return Response(deal_crm_card(deal, actor=request.user))

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self._filtered_for_analytics()
        return Response(build_deal_summary(queryset, user=request.user))

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
        return sla_overdue_deals_queryset(queryset)


class StageTransitionViewSet(TenantModelViewSet):
    queryset = StageTransition.objects.select_related("business", "pipeline", "from_stage", "to_stage")
    serializer_class = StageTransitionSerializer
