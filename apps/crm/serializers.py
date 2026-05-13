from rest_framework import serializers

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
    class Meta:
        model = Deal
        fields = "__all__"

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

