from rest_framework import serializers

from apps.businesses.access import Resources, can_view_sensitive_field
from apps.core.work_queues import deal_risk, deal_sla_overdue
from apps.crm.models import Deal, Pipeline, PipelineStage, StageTransition


class PipelineStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PipelineStage
        fields = [
            "id",
            "business",
            "pipeline",
            "name",
            "order",
            "color",
            "probability",
            "sla_minutes",
            "required_fields_json",
            "allowed_roles_json",
            "is_won",
            "is_lost",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class PipelineSerializer(serializers.ModelSerializer):
    stages = PipelineStageSerializer(many=True, read_only=True)

    class Meta:
        model = Pipeline
        fields = [
            "id",
            "business",
            "name",
            "slug",
            "entity_type",
            "is_default",
            "template_key",
            "stages",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "stages"]


class DealSerializer(serializers.ModelSerializer):
    sla_overdue = serializers.SerializerMethodField()
    lifecycle_update_fields = {
        "stage",
        "status",
        "probability",
        "lost_reason",
        "lost_by",
        "won_at",
        "lost_at",
        "previous_status",
        "previous_stage",
        "stage_entered_at",
    }
    archive_update_fields = {"is_archived", "archive_reason", "archived_at", "archived_by"}

    class Meta:
        model = Deal
        fields = [
            "id",
            "business",
            "client",
            "lead",
            "pipeline",
            "stage",
            "title",
            "amount",
            "currency",
            "probability",
            "expected_close_at",
            "owner",
            "status",
            "source",
            "lost_reason",
            "lost_by",
            "won_at",
            "lost_at",
            "previous_status",
            "previous_stage",
            "stage_entered_at",
            "next_action_at",
            "notes",
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "sla_overdue",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["sla_overdue", "lost_at", "lost_by", "previous_status", "previous_stage", "archived_at", "archived_by"]

    def get_sla_overdue(self, obj):
        return deal_sla_overdue(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and not can_view_sensitive_field(user, instance.business, Resources.DEALS, "amount"):
            data["amount"] = None
            data["currency"] = ""
        if user and not can_view_sensitive_field(user, instance.business, Resources.DEALS, "notes"):
            data["notes"] = ""
            data["lost_reason"] = ""
        return data

    def validate(self, attrs):
        attempted_archive_fields = sorted(self.archive_update_fields.intersection((self.initial_data or {}).keys()))
        if attempted_archive_fields:
            raise serializers.ValidationError(
                {
                    "detail": "Use deal archive action endpoints for archive state changes.",
                    "fields": attempted_archive_fields,
                }
            )
        if self.instance is not None:
            attempted_lifecycle_fields = sorted(self.lifecycle_update_fields.intersection((self.initial_data or {}).keys()))
            if attempted_lifecycle_fields:
                raise serializers.ValidationError(
                    {
                        "detail": "Use deal lifecycle action endpoints for protected state changes.",
                        "fields": attempted_lifecycle_fields,
                    }
                )
        pipeline = attrs.get("pipeline") or getattr(self.instance, "pipeline", None)
        stage = attrs.get("stage") or getattr(self.instance, "stage", None)
        business = attrs.get("business") or getattr(self.instance, "business", None)
        if stage and pipeline and stage.pipeline_id != pipeline.id:
            raise serializers.ValidationError("Stage must belong to selected pipeline.")
        if stage and business and stage.business_id != business.id:
            raise serializers.ValidationError("Stage must belong to selected business.")
        return attrs


class DealListSerializer(DealSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    client_phone = serializers.CharField(source="client.phone", read_only=True)
    client_email = serializers.CharField(source="client.email", read_only=True)
    stage_name = serializers.CharField(source="stage.name", read_only=True)
    stage_color = serializers.CharField(source="stage.color", read_only=True)
    stage_order = serializers.IntegerField(source="stage.order", read_only=True)
    stage_probability = serializers.IntegerField(source="stage.probability", read_only=True)
    stage_is_won = serializers.BooleanField(source="stage.is_won", read_only=True)
    stage_is_lost = serializers.BooleanField(source="stage.is_lost", read_only=True)
    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    next_task_id = serializers.SerializerMethodField()
    next_task_title = serializers.SerializerMethodField()
    next_task_due_at = serializers.SerializerMethodField()
    next_task_priority = serializers.SerializerMethodField()
    risk_level = serializers.SerializerMethodField()
    risk_percent = serializers.SerializerMethodField()

    class Meta(DealSerializer.Meta):
        fields = [
            "id",
            "business",
            "client",
            "client_name",
            "client_phone",
            "client_email",
            "lead",
            "pipeline",
            "stage",
            "stage_name",
            "stage_color",
            "stage_order",
            "stage_probability",
            "stage_is_won",
            "stage_is_lost",
            "title",
            "amount",
            "currency",
            "probability",
            "expected_close_at",
            "owner",
            "owner_name",
            "owner_email",
            "status",
            "source",
            "lost_reason",
            "lost_by",
            "previous_status",
            "previous_stage",
            "won_at",
            "lost_at",
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "stage_entered_at",
            "next_action_at",
            "sla_overdue",
            "next_task_id",
            "next_task_title",
            "next_task_due_at",
            "next_task_priority",
            "risk_level",
            "risk_percent",
            "notes",
            "created_at",
            "updated_at",
        ]

    def _next_task(self, obj):
        tasks = getattr(obj, "open_tasks_for_list", None)
        if tasks is not None:
            return tasks[0] if tasks else None
        return obj.tasks.exclude(status__in=["done", "cancelled"]).order_by("due_at", "-created_at").first()

    def get_owner_name(self, obj):
        if not obj.owner:
            return ""
        return getattr(obj.owner, "full_name", "") or obj.owner.get_full_name() or obj.owner.email

    def get_next_task_id(self, obj):
        task = self._next_task(obj)
        return task.id if task else None

    def get_next_task_title(self, obj):
        task = self._next_task(obj)
        return task.title if task else ""

    def get_next_task_due_at(self, obj):
        task = self._next_task(obj)
        return task.due_at if task else None

    def get_next_task_priority(self, obj):
        task = self._next_task(obj)
        return task.priority if task else ""

    def _risk(self, obj):
        return deal_risk(obj, next_task=self._next_task(obj))

    def get_risk_level(self, obj):
        return self._risk(obj)[0]

    def get_risk_percent(self, obj):
        return self._risk(obj)[1]


class StageTransitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageTransition
        fields = [
            "id",
            "business",
            "pipeline",
            "from_stage",
            "to_stage",
            "required_permission",
            "conditions",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
