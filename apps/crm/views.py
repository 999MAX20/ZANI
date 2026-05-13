from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.activities.services import write_activity_event
from apps.core.crm_cards import deal_crm_card
from apps.core.viewsets import TenantModelViewSet
from apps.crm.models import Deal, Pipeline, PipelineStage, StageTransition
from apps.crm.serializers import DealSerializer, PipelineSerializer, PipelineStageSerializer, StageTransitionSerializer


class PipelineViewSet(TenantModelViewSet):
    queryset = Pipeline.objects.prefetch_related("stages").select_related("business")
    serializer_class = PipelineSerializer


class PipelineStageViewSet(TenantModelViewSet):
    queryset = PipelineStage.objects.select_related("business", "pipeline")
    serializer_class = PipelineStageSerializer


class DealViewSet(TenantModelViewSet):
    queryset = Deal.objects.select_related("business", "client", "lead", "pipeline", "stage", "owner")
    serializer_class = DealSerializer

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
        deal.stage = stage
        deal.probability = stage.probability
        if stage.is_won:
            deal.status = Deal.Statuses.WON
        elif stage.is_lost:
            deal.status = Deal.Statuses.LOST
        else:
            deal.status = Deal.Statuses.OPEN
        deal.save(update_fields=["stage", "probability", "status", "updated_at"])
        write_activity_event(request, "deal_stage_changed", deal, text=f"Сделка перешла на стадию: {stage.name}")
        return Response(DealSerializer(deal).data)

    @action(detail=True, methods=["get"], url_path="crm-card")
    def crm_card(self, request, pk=None):
        deal = self.get_object()
        return Response(deal_crm_card(deal))


class StageTransitionViewSet(TenantModelViewSet):
    queryset = StageTransition.objects.select_related("business", "pipeline", "from_stage", "to_stage")
    serializer_class = StageTransitionSerializer
