from django.contrib import admin

from apps.outreach.models import OutreachCampaign, OutreachConsent, OutreachRecipient, OutreachTemplate


@admin.register(OutreachTemplate)
class OutreachTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "channel", "is_active", "updated_at")
    list_filter = ("channel", "is_active", "business")
    search_fields = ("name", "body", "business__name")


@admin.register(OutreachCampaign)
class OutreachCampaignAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "channel", "status", "audience_type", "scheduled_at", "updated_at")
    list_filter = ("channel", "status", "audience_type", "business")
    search_fields = ("name", "message_text", "business__name")


@admin.register(OutreachRecipient)
class OutreachRecipientAdmin(admin.ModelAdmin):
    list_display = ("campaign", "client", "channel", "status", "skipped_reason", "notification", "sent_at")
    list_filter = ("status", "campaign__channel", "business")
    search_fields = ("campaign__name", "client__full_name", "client__phone", "recipient_id")

    def channel(self, obj):
        return obj.campaign.channel


@admin.register(OutreachConsent)
class OutreachConsentAdmin(admin.ModelAdmin):
    list_display = ("business", "client", "channel", "status", "source", "opted_in_at", "opted_out_at")
    list_filter = ("channel", "status", "business")
    search_fields = ("client__full_name", "client__phone", "source", "note")
