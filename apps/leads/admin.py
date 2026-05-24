from django.contrib import admin

from apps.leads.models import Lead, LeadForm, LeadFormField, LeadFormSubmission, LeadFormSubmissionError


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
class LeadFormSubmissionErrorAdmin(admin.ModelAdmin):
    list_display = ("id", "form", "business", "landing_id", "page_domain", "error_message", "created_at")
    list_filter = ("business", "form", "page_domain")
    search_fields = ("public_id", "landing_id", "page_domain", "error_message")
    readonly_fields = ("created_at",)
