from django.contrib import admin

from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage


class BotChannelInline(admin.TabularInline):
    model = BotChannel
    extra = 0
    fields = ("channel", "status", "external_id", "public_token")
    readonly_fields = ("public_token",)


@admin.register(Bot)
class BotAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "status", "default_language", "created_at")
    list_filter = ("status", "default_language", "business")
    search_fields = ("name", "business__name")
    inlines = [BotChannelInline]


@admin.register(BotChannel)
class BotChannelAdmin(admin.ModelAdmin):
    list_display = ("bot", "channel", "status", "external_id", "public_token", "created_at")
    list_filter = ("channel", "status", "bot__business")
    search_fields = ("bot__name", "bot__business__name", "external_id", "public_token")
    readonly_fields = ("public_token",)


@admin.register(BotConversation)
class BotConversationAdmin(admin.ModelAdmin):
    list_display = ("bot", "business", "channel", "public_id", "client", "lead", "status", "updated_at")
    list_filter = ("channel", "status", "business")
    search_fields = ("bot__name", "business__name", "public_id", "external_user_id", "client__full_name")
    readonly_fields = ("public_id",)


@admin.register(BotMessage)
class BotMessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "direction", "status", "created_at")
    list_filter = ("direction", "status", "conversation__channel")
    search_fields = ("text", "conversation__bot__name", "conversation__external_user_id")
