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
