from django.contrib import admin

from apps.conversations.models import Conversation, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("business", "client", "channel", "external_chat_id", "status", "updated_at")
    list_filter = ("channel", "status", "business")
    search_fields = ("client__full_name", "external_chat_id", "business__name")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "sender_type", "created_at")
    list_filter = ("sender_type", "conversation__channel")
    search_fields = ("text", "conversation__client__full_name")
