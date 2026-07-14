from django.contrib import admin

from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text
from apps.leads.models import Lead, LeadForm, LeadFormField, LeadFormSubmission, LeadFormSubmissionError


class ReadOnlyLogAdminMixin:
    def has_add_permission(self, request):
        return False


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("id", "business", "client", "service", "source", "status", "responsible_user", "created_at")
    list_filter = ("status", "source", "business")
    search_fields = ("client__full_name", "client__phone", "message", "business__name")


class LeadFormFieldInline(admin.TabularInline):
    model = LeadFormField
    extra = 0


@admin.register(LeadForm)
class LeadFormAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "source", "landing_id", "landing_domain", "is_active", "created_at")
    list_filter = ("source", "is_active", "business")
    search_fields = ("name", "title", "landing_id", "landing_domain", "business__name")
    inlines = [LeadFormFieldInline]


@admin.register(LeadFormSubmission)
class LeadFormSubmissionAdmin(admin.ModelAdmin):
    list_display = ("id", "form", "business", "client", "lead", "landing_id", "page_domain", "created_at")
    list_filter = ("business", "form", "page_domain")
    search_fields = ("form__name", "landing_id", "page_domain", "client__full_name", "client__phone", "lead__message")


@admin.register(LeadFormSubmissionError)
class LeadFormSubmissionErrorAdmin(ReadOnlyLogAdminMixin, admin.ModelAdmin):
    list_display = ("id", "form", "business", "landing_id", "page_domain", "safe_error_message", "created_at")
    list_filter = ("business", "form", "page_domain")
    search_fields = ("public_id", "landing_id", "page_domain")
    exclude = ("payload_json", "error_message")
    readonly_fields = ("safe_payload_json", "safe_error_message", "created_at")

    def safe_payload_json(self, obj):
        return sanitize_error_payload(getattr(obj, "payload_json", {}))

    safe_payload_json.short_description = "Payload (safe)"

    def safe_error_message(self, obj):
        return sanitize_error_text(getattr(obj, "error_message", ""))

    safe_error_message.short_description = "Error message (safe)"
