from django.conf import settings
from django.db import models

from apps.businesses.models import Business, TimeStampedModel


class AIRequestLog(models.Model):
    class Sources(models.TextChoices):
        CRM = "crm", "CRM"
        BOT = "bot", "Bot"
        AUTOMATION = "automation", "Automation"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="ai_request_logs")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_request_logs",
    )
    source = models.CharField(max_length=32, choices=Sources.choices)
    prompt_type = models.CharField(max_length=64)
    input_json = models.JSONField(default=dict, blank=True)
    output_text = models.TextField(blank=True)
    model = models.CharField(max_length=128, blank=True)
    tokens_used = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.source}:{self.prompt_type} for {self.business}"


class BusinessKnowledgeItem(TimeStampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="knowledge_items")
    title = models.CharField(max_length=255)
    content = models.TextField()
    category = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["category", "title"]

    def __str__(self):
        return f"{self.title} ({self.business})"


class AgentProfile(TimeStampedModel):
    class Tones(models.TextChoices):
        FRIENDLY = "friendly", "Friendly"
        EXPERT = "expert", "Expert"
        FORMAL = "formal", "Formal"
        SALES = "sales", "Sales"
        SUPPORT = "support", "Support"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="agent_profiles")
    bot = models.ForeignKey("bots.Bot", on_delete=models.SET_NULL, null=True, blank=True, related_name="agent_profiles")
    name = models.CharField(max_length=255)
    role_description = models.TextField(blank=True)
    tone = models.CharField(max_length=32, choices=Tones.choices, default=Tones.FRIENDLY)
    language = models.CharField(max_length=16, default="ru")
    is_active = models.BooleanField(default=True)
    system_prompt = models.TextField(blank=True)
    rules_json = models.JSONField(default=dict, blank=True)
    allowed_tools_json = models.JSONField(default=dict, blank=True)
    escalation_rules_json = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-is_active", "name"]
        indexes = [
            models.Index(fields=["business", "is_active"]),
            models.Index(fields=["bot", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.business})"


class AIToolCallLog(models.Model):
    class Statuses(models.TextChoices):
        SUGGESTED = "suggested", "Suggested"
        EXECUTED = "executed", "Executed"
        FAILED = "failed", "Failed"
        REJECTED = "rejected", "Rejected"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="ai_tool_call_logs")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_tool_call_logs",
    )
    conversation = models.ForeignKey(
        "bots.BotConversation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_tool_call_logs",
    )
    tool_name = models.CharField(max_length=64)
    input_json = models.JSONField(default=dict, blank=True)
    output_json = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.SUGGESTED)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "status", "tool_name"]),
            models.Index(fields=["conversation", "status"]),
        ]

    def __str__(self):
        return f"{self.tool_name} ({self.status}) for {self.business}"
