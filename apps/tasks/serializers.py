from rest_framework import serializers

from apps.tasks.models import Task, TaskComment


class TaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = TaskComment
        fields = ["id", "task", "author", "author_name", "author_email", "text", "created_at"]
        read_only_fields = ["author", "author_name", "author_email", "created_at"]


class TaskSnoozeSerializer(serializers.Serializer):
    snoozed_until = serializers.DateTimeField()


class TaskCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(trim_whitespace=True, min_length=3, max_length=2000)


class TaskDetailsUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "title",
            "description",
            "client",
            "lead",
            "deal",
            "appointment",
            "conversation",
            "parent_task",
            "assignee",
            "priority",
            "due_at",
            "reminder_at",
        ]
        extra_kwargs = {field: {"required": False} for field in fields}

    def validate(self, attrs):
        business = getattr(self.instance, "business", None)
        related_fields = ["client", "lead", "deal", "appointment", "conversation", "parent_task"]
        for field in related_fields:
            obj = attrs.get(field)
            if obj and business and obj.business_id != business.id:
                raise serializers.ValidationError({field: "Must belong to the task business."})

        assignee = attrs.get("assignee")
        if assignee and business and not business.members.filter(user=assignee, is_active=True).exists():
            raise serializers.ValidationError({"assignee": "Assignee must be an active business member."})
        return attrs


class TaskSerializer(serializers.ModelSerializer):
    comments_count = serializers.IntegerField(read_only=True)
    watchers_count = serializers.IntegerField(read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    lead_title = serializers.SerializerMethodField()
    deal_title = serializers.CharField(source="deal.title", read_only=True)
    appointment_start_at = serializers.DateTimeField(source="appointment.start_at", read_only=True)
    appointment_service_name = serializers.CharField(source="appointment.service.name", read_only=True)
    conversation_label = serializers.SerializerMethodField()
    conversation_channel = serializers.CharField(source="conversation.channel", read_only=True)
    conversation_external_user_id = serializers.CharField(source="conversation.external_user_id", read_only=True)
    assignee_name = serializers.CharField(source="assignee.full_name", read_only=True)
    assignee_email = serializers.EmailField(source="assignee.email", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    lifecycle_update_fields = {"status", "completed_at", "completed_by"}
    action_create_fields = {"watchers", "snoozed_until"}
    action_update_fields = {"assignee", "watchers", "created_by", "snoozed_until"}
    archive_update_fields = {"is_archived", "archive_reason", "archived_at", "archived_by"}

    class Meta:
        model = Task
        fields = [
            "id",
            "business",
            "title",
            "description",
            "client",
            "client_name",
            "lead",
            "lead_title",
            "deal",
            "deal_title",
            "appointment",
            "appointment_start_at",
            "appointment_service_name",
            "conversation",
            "conversation_label",
            "conversation_channel",
            "conversation_external_user_id",
            "parent_task",
            "assignee",
            "assignee_name",
            "assignee_email",
            "created_by",
            "created_by_name",
            "created_by_email",
            "watchers",
            "due_at",
            "reminder_at",
            "snoozed_until",
            "priority",
            "status",
            "recurrence_rule",
            "completed_at",
            "completed_by",
            "cancelled_at",
            "cancelled_by",
            "cancel_reason",
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "comments_count",
            "watchers_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "archived_at",
            "archived_by",
            "created_by",
            "completed_at",
            "completed_by",
            "cancelled_at",
            "cancelled_by",
            "cancel_reason",
            "comments_count",
            "watchers_count",
        ]

    def get_lead_title(self, obj):
        if not obj.lead_id:
            return ""
        client_name = getattr(getattr(obj, "lead", None), "client_name", "") or getattr(getattr(getattr(obj, "lead", None), "client", None), "full_name", "")
        return client_name or f"Lead #{obj.lead_id}"

    def get_conversation_label(self, obj):
        if not obj.conversation_id:
            return ""
        conversation = getattr(obj, "conversation", None)
        if conversation is None:
            return f"Conversation #{obj.conversation_id}"
        client = getattr(conversation, "client", None)
        if client is not None and getattr(client, "full_name", ""):
            return client.full_name
        return conversation.external_user_id or f"{conversation.channel} #{obj.conversation_id}"

    def validate(self, attrs):
        attempted_archive_fields = sorted(self.archive_update_fields.intersection((self.initial_data or {}).keys()))
        if attempted_archive_fields:
            raise serializers.ValidationError(
                {
                    "detail": "Use task archive action endpoints for archive state changes.",
                    "fields": attempted_archive_fields,
                }
            )
        attempted_lifecycle_fields = sorted(self.lifecycle_update_fields.intersection((self.initial_data or {}).keys()))
        if attempted_lifecycle_fields:
            raise serializers.ValidationError(
                {
                    "detail": "Use task lifecycle action endpoints for protected state changes.",
                    "fields": attempted_lifecycle_fields,
                }
            )
        if self.instance is None:
            attempted_action_fields = sorted(self.action_create_fields.intersection((self.initial_data or {}).keys()))
            if attempted_action_fields:
                raise serializers.ValidationError(
                    {
                        "detail": "Use task action endpoints for watcher and snooze changes.",
                        "fields": attempted_action_fields,
                    }
                )
        else:
            attempted_action_fields = sorted(self.action_update_fields.intersection((self.initial_data or {}).keys()))
            if attempted_action_fields:
                raise serializers.ValidationError(
                    {
                        "detail": "Use task action endpoints for assignment, watcher and snooze changes.",
                        "fields": attempted_action_fields,
                    }
                )
        business = attrs.get("business") or getattr(self.instance, "business", None)
        related_fields = ["client", "lead", "deal", "appointment", "conversation", "parent_task"]
        for field in related_fields:
            obj = attrs.get(field) if field in attrs else getattr(self.instance, field, None)
            if obj and business and obj.business_id != business.id:
                raise serializers.ValidationError(f"{field} must belong to the selected business.")
        assignee = attrs.get("assignee") if "assignee" in attrs else getattr(self.instance, "assignee", None)
        if assignee and business and not business.members.filter(user=assignee, is_active=True).exists():
            raise serializers.ValidationError("Assignee must be an active business member.")
        return attrs
