from rest_framework import serializers
from django.utils import timezone

from apps.crm.models import Deal, Pipeline, PipelineStage, StageTransition


class PipelineStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PipelineStage
        fields = "__all__"


class PipelineSerializer(serializers.ModelSerializer):
    stages = PipelineStageSerializer(many=True, read_only=True)

    class Meta:
        model = Pipeline
        fields = "__all__"


class DealSerializer(serializers.ModelSerializer):
    sla_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Deal
        fields = "__all__"
        read_only_fields = ["sla_overdue", "lost_at", "lost_by", "previous_status", "previous_stage", "archived_at", "archived_by"]

    def get_sla_overdue(self, obj):
        if not obj.stage or not obj.stage.sla_minutes or not obj.stage_entered_at:
            return False
        return timezone.now() > obj.stage_entered_at + timezone.timedelta(minutes=obj.stage.sla_minutes)

    def validate(self, attrs):
        pipeline = attrs.get("pipeline") or getattr(self.instance, "pipeline", None)
        stage = attrs.get("stage") or getattr(self.instance, "stage", None)
        business = attrs.get("business") or getattr(self.instance, "business", None)
        if stage and pipeline and stage.pipeline_id != pipeline.id:
            raise serializers.ValidationError("Stage must belong to selected pipeline.")
        if stage and business and stage.business_id != business.id:
            raise serializers.ValidationError("Stage must belong to selected business.")
        return attrs


class StageTransitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageTransition
        fields = "__all__"
