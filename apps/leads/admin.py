from django.contrib import admin

from apps.leads.models import Lead, LeadForm, LeadFormField, LeadFormSubmission


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
    list_display = ("name", "business", "source", "is_active", "created_at")
    list_filter = ("source", "is_active", "business")
    search_fields = ("name", "title", "business__name")
    inlines = [LeadFormFieldInline]


@admin.register(LeadFormSubmission)
class LeadFormSubmissionAdmin(admin.ModelAdmin):
    list_display = ("id", "form", "business", "client", "lead", "created_at")
    list_filter = ("business", "form")
    search_fields = ("form__name", "client__full_name", "client__phone", "lead__message")
