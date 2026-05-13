from django.db import models

from apps.businesses.models import Business, TimeStampedModel


class AutomationRule(TimeStampedModel):
    class TriggerTypes(models.TextChoices):
        LEAD_CREATED = "lead_created", "Lead created"
        DEAL_CREATED = "deal_created", "Deal created"
        STAGE_CHANGED = "stage_changed", "Stage changed"
        MESSAGE_RECEIVED = "message_received", "Message received"
        BOT_MESSAGE_RECEIVED = "bot_message_received", "Bot message received"
        TASK_OVERDUE = "task_overdue", "Task overdue"
        APPOINTMENT_CREATED = "appointment_created", "Appointment created"
        APPOINTMENT_CANCELLED = "appointment_cancelled", "Appointment cancelled"
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
        ASSIGN_MANAGER = "assign_manager", "Assign manager"
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
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="automation_runs")
    rule = models.ForeignKey(AutomationRule, on_delete=models.SET_NULL, null=True, blank=True, related_name="runs")
    trigger_type = models.CharField(max_length=64)
    entity_type = models.CharField(max_length=96, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.PENDING)
    payload = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "trigger_type", "created_at"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.trigger_type}: {self.status}"
