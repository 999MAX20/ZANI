from django.db import models

from apps.businesses.models import Business, TimeStampedModel


class AutomationRule(TimeStampedModel):
    class TriggerTypes(models.TextChoices):
        LEAD_CREATED = "lead_created", "Lead created"
        LEAD_STATUS_CHANGED = "lead_status_changed", "Lead status changed"
        DEAL_CREATED = "deal_created", "Deal created"
        DEAL_STAGE_CHANGED = "deal_stage_changed", "Deal stage changed"
        STAGE_CHANGED = "stage_changed", "Stage changed"
        MESSAGE_RECEIVED = "message_received", "Message received"
        BOT_MESSAGE_RECEIVED = "bot_message_received", "Bot message received"
        CONVERSATION_UNREAD = "conversation_unread", "Conversation unread"
        TASK_OVERDUE = "task_overdue", "Task overdue"
        APPOINTMENT_CREATED = "appointment_created", "Appointment created"
        APPOINTMENT_CANCELLED = "appointment_cancelled", "Appointment cancelled"
        APPOINTMENT_COMPLETED = "appointment_completed", "Appointment completed"
        CLIENT_INACTIVE = "client_inactive", "Client inactive"
        TAG_ADDED = "tag_added", "Tag added"
        TAG_REMOVED = "tag_removed", "Tag removed"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="automation_rules")
    name = models.CharField(max_length=255)
    trigger_type = models.CharField(max_length=64, choices=TriggerTypes.choices)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=False)
    priority = models.PositiveIntegerField(default=100)

    class Meta:
        ordering = ["priority", "name"]
        indexes = [
            models.Index(fields=["business", "trigger_type", "is_active"]),
        ]

    def __str__(self):
        return self.name


class AutomationCondition(models.Model):
    class Operators(models.TextChoices):
        EQ = "eq", "Equals"
        GT = "gt", "Greater than"
        LT = "lt", "Less than"
        CONTAINS = "contains", "Contains"
        IN = "in", "In"

    rule = models.ForeignKey(AutomationRule, on_delete=models.CASCADE, related_name="conditions")
    field = models.CharField(max_length=128)
    operator = models.CharField(max_length=32, choices=Operators.choices, default=Operators.EQ)
    value = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.field} {self.operator}"


class AutomationAction(models.Model):
    class ActionTypes(models.TextChoices):
        CREATE_TASK = "create_task", "Create task"
        CREATE_FOLLOW_UP = "create_follow_up", "Create follow-up"
        ASSIGN_MANAGER = "assign_manager", "Assign manager"
        ASSIGN_USER = "assign_user", "Assign user"
        ADD_NOTE = "add_note", "Add note"
        MOVE_STAGE = "move_stage", "Move stage"
        CREATE_NOTIFICATION = "create_notification", "Create notification"
        WEBHOOK = "webhook", "Webhook"
        WAIT = "wait", "Wait"
        AI_SUMMARIZE = "ai_summarize", "AI summarize"
        AI_RESPOND = "ai_respond", "AI respond"

    rule = models.ForeignKey(AutomationRule, on_delete=models.CASCADE, related_name="actions")
    action_type = models.CharField(max_length=64, choices=ActionTypes.choices)
    config = models.JSONField(default=dict, blank=True)
    order = models.PositiveIntegerField(default=0)
    delay_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["rule", "order"]

    def __str__(self):
        return self.action_type


class AutomationRun(models.Model):
    class Statuses(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        WAITING = "waiting", "Waiting"
        RETRY_SCHEDULED = "retry_scheduled", "Retry scheduled"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"
        CANCELLED = "cancelled", "Cancelled"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="automation_runs")
    rule = models.ForeignKey(AutomationRule, on_delete=models.SET_NULL, null=True, blank=True, related_name="runs")
    trigger_type = models.CharField(max_length=64)
    entity_type = models.CharField(max_length=96, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)
    idempotency_key = models.CharField(max_length=160, blank=True, null=True, db_index=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.PENDING)
    payload = models.JSONField(default=dict, blank=True)
    action_results = models.JSONField(default=list, blank=True)
    current_action_index = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=3)
    run_after = models.DateTimeField(null=True, blank=True)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["business", "idempotency_key"], name="unique_automation_run_idempotency_key"),
        ]
        indexes = [
            models.Index(fields=["business", "trigger_type", "created_at"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["business", "status", "run_after"]),
            models.Index(fields=["business", "next_retry_at"]),
            models.Index(fields=["status", "run_after", "next_retry_at"]),
        ]

    def __str__(self):
        return f"{self.trigger_type}: {self.status}"
