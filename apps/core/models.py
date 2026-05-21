from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.businesses.models import Business


def attachment_upload_path(instance, filename):
    business_id = instance.business_id or "unknown"
    return f"private/attachments/business-{business_id}/{filename}"


class AuditLog(models.Model):
    class Actions(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        DOWNLOAD = "download", "Download"
        SUPPORT_ACCESS = "support_access", "Support access"

    class Categories(models.TextChoices):
        DATA = "data", "Data"
        ACCESS = "access", "Access"
        SECURITY = "security", "Security"
        SYSTEM = "system", "System"
        INTEGRATION = "integration", "Integration"

    class RiskLevels(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="audit_logs", null=True, blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    action = models.CharField(max_length=32, choices=Actions.choices)
    category = models.CharField(max_length=32, choices=Categories.choices, default=Categories.DATA)
    risk_level = models.CharField(max_length=32, choices=RiskLevels.choices, default=RiskLevels.LOW)
    entity_type = models.CharField(max_length=128)
    entity_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "created_at"]),
            models.Index(fields=["actor", "created_at"]),
            models.Index(fields=["entity_type", "entity_id"]),
            models.Index(fields=["business", "risk_level", "created_at"]),
            models.Index(fields=["business", "category", "created_at"]),
        ]

    def __str__(self):
        return f"{self.action} {self.entity_type}#{self.entity_id}"


class SupportAccessGrant(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="support_access_grants")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="support_access_grants")
    reason = models.TextField()
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_support_access_grants",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "user", "is_active", "expires_at"]),
        ]

    def is_valid(self):
        return self.is_active and self.expires_at > timezone.now()

    def __str__(self):
        return f"{self.user} support access to {self.business} until {self.expires_at}"


class LoginHistory(models.Model):
    class Statuses(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    business = models.ForeignKey(Business, on_delete=models.SET_NULL, null=True, blank=True, related_name="login_history")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="login_history")
    email = models.EmailField(blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "created_at"]),
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.email or self.user_id} login {self.status}"


class FileAttachment(models.Model):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="file_attachments")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="file_attachments")
    file = models.FileField(upload_to=attachment_upload_path)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=128, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    entity_type = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=64)
    visibility = models.CharField(max_length=32, choices=Visibility.choices, default=Visibility.PRIVATE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "entity_type", "entity_id", "created_at"]),
            models.Index(fields=["uploaded_by", "created_at"]),
        ]

    def __str__(self):
        return f"{self.original_name} ({self.entity_type}#{self.entity_id})"


class CustomFieldDefinition(models.Model):
    class EntityTypes(models.TextChoices):
        CLIENT = "client", "Client"
        LEAD = "lead", "Lead"
        DEAL = "deal", "Deal"
        APPOINTMENT = "appointment", "Appointment"

    class FieldTypes(models.TextChoices):
        TEXT = "text", "Text"
        TEXTAREA = "textarea", "Textarea"
        NUMBER = "number", "Number"
        MONEY = "money", "Money"
        DATE = "date", "Date"
        DATETIME = "datetime", "Datetime"
        SELECT = "select", "Select"
        MULTISELECT = "multiselect", "Multiselect"
        BOOLEAN = "boolean", "Boolean"
        PHONE = "phone", "Phone"
        EMAIL = "email", "Email"
        URL = "url", "URL"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="custom_field_definitions")
    entity_type = models.CharField(max_length=32, choices=EntityTypes.choices)
    key = models.SlugField(max_length=64)
    label = models.CharField(max_length=128)
    field_type = models.CharField(max_length=32, choices=FieldTypes.choices, default=FieldTypes.TEXT)
    options_json = models.JSONField(default=dict, blank=True)
    is_required = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["entity_type", "sort_order", "label"]
        constraints = [
            models.UniqueConstraint(fields=["business", "entity_type", "key"], name="unique_custom_field_key_per_entity"),
        ]
        indexes = [
            models.Index(fields=["business", "entity_type", "is_active", "sort_order"]),
        ]

    def __str__(self):
        return f"{self.business}: {self.entity_type}.{self.key}"


class CustomFieldValue(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="custom_field_values")
    definition = models.ForeignKey(CustomFieldDefinition, on_delete=models.CASCADE, related_name="values")
    entity_type = models.CharField(max_length=32, choices=CustomFieldDefinition.EntityTypes.choices)
    entity_id = models.CharField(max_length=64)
    value_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["definition__sort_order", "definition__label"]
        constraints = [
            models.UniqueConstraint(fields=["definition", "entity_type", "entity_id"], name="unique_custom_field_value_per_entity"),
        ]
        indexes = [
            models.Index(fields=["business", "entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"{self.definition.key}={self.value_json}"


class ImportJob(models.Model):
    class EntityTypes(models.TextChoices):
        CLIENTS = "clients", "Clients"
        LEADS = "leads", "Leads"
        DEALS = "deals", "Deals"

    class Statuses(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        PREVIEWED = "previewed", "Previewed"
        IMPORTED = "imported", "Imported"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="import_jobs")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="import_jobs")
    entity_type = models.CharField(max_length=32, choices=EntityTypes.choices, default=EntityTypes.CLIENTS)
    source_file = models.FileField(upload_to="imports/%Y/%m/%d/")
    original_filename = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.UPLOADED)
    mapping_json = models.JSONField(default=dict, blank=True)
    preview_json = models.JSONField(default=dict, blank=True)
    duplicates_json = models.JSONField(default=dict, blank=True)
    total_rows = models.PositiveIntegerField(default=0)
    imported_count = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    imported_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "entity_type", "status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.business}: {self.entity_type} import #{self.id}"
