from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.auth_views import ThrottledTokenObtainPairView, ThrottledTokenRefreshView
from apps.accounts.views import CurrentUserView
from apps.activities.views import ActivityEventViewSet, NoteViewSet, TaggedObjectViewSet, TagViewSet
from apps.ai_core.views import AIAssistantChatView, AIRequestLogViewSet, BusinessKnowledgeItemViewSet
from apps.analytics.views import AnalyticsEventViewSet
from apps.automations.views import AutomationActionViewSet, AutomationConditionViewSet, AutomationRuleViewSet, AutomationRunViewSet
from apps.billing.views import CurrentSubscriptionViewSet, SubscriptionPlanViewSet
from apps.bots.views import (
    BotChannelViewSet,
    BotConversationViewSet,
    BotMessageViewSet,
    BotViewSet,
    PublicWebsiteChatChannelView,
    PublicWebsiteChatConversationCreateView,
    PublicWebsiteChatMessageCreateView,
)
from apps.businesses.views import BusinessMemberViewSet, BusinessViewSet
from apps.clients.views import ClientViewSet
from apps.conversations.views import ConversationViewSet, MessageViewSet
from apps.core.views import health, health_db, platform_ping
from apps.crm.views import DealViewSet, PipelineStageViewSet, PipelineViewSet, StageTransitionViewSet
from apps.integrations.views import TelegramWebhookView
from apps.leads.views import LeadViewSet
from apps.notifications.views import NotificationViewSet
from apps.scheduling.views import AppointmentViewSet, ResourceViewSet, WorkingHoursViewSet
from apps.services.views import ServiceViewSet
from apps.tasks.views import TaskViewSet


router = DefaultRouter()
router.register("businesses", BusinessViewSet, basename="business")
router.register("business-members", BusinessMemberViewSet, basename="business-member")
router.register("clients", ClientViewSet, basename="client")
router.register("pipelines", PipelineViewSet, basename="pipeline")
router.register("pipeline-stages", PipelineStageViewSet, basename="pipeline-stage")
router.register("stage-transitions", StageTransitionViewSet, basename="stage-transition")
router.register("deals", DealViewSet, basename="deal")
router.register("services", ServiceViewSet, basename="service")
router.register("leads", LeadViewSet, basename="lead")
router.register("resources", ResourceViewSet, basename="resource")
router.register("working-hours", WorkingHoursViewSet, basename="working-hours")
router.register("appointments", AppointmentViewSet, basename="appointment")
router.register("conversations", ConversationViewSet, basename="conversation")
router.register("messages", MessageViewSet, basename="message")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("analytics-events", AnalyticsEventViewSet, basename="analytics-event")
router.register("activity-events", ActivityEventViewSet, basename="activity-event")
router.register("notes", NoteViewSet, basename="note")
router.register("tags", TagViewSet, basename="tag")
router.register("tagged-objects", TaggedObjectViewSet, basename="tagged-object")
router.register("tasks", TaskViewSet, basename="task")
router.register("automation-rules", AutomationRuleViewSet, basename="automation-rule")
router.register("automation-conditions", AutomationConditionViewSet, basename="automation-condition")
router.register("automation-actions", AutomationActionViewSet, basename="automation-action")
router.register("automation-runs", AutomationRunViewSet, basename="automation-run")
router.register("billing/plans", SubscriptionPlanViewSet, basename="billing-plan")
router.register("billing/current-subscription", CurrentSubscriptionViewSet, basename="current-subscription")
router.register("bots", BotViewSet, basename="bot")
router.register("bot-channels", BotChannelViewSet, basename="bot-channel")
router.register("bot-conversations", BotConversationViewSet, basename="bot-conversation")
router.register("bot-messages", BotMessageViewSet, basename="bot-message")
router.register("ai/request-logs", AIRequestLogViewSet, basename="ai-request-log")
router.register("ai/knowledge-items", BusinessKnowledgeItemViewSet, basename="ai-knowledge-item")

urlpatterns = [
    path("health/", health, name="health"),
    path("health/db/", health_db, name="health_db"),
    path("admin/", admin.site.urls),
    path("api/auth/token/", ThrottledTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", ThrottledTokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/me/", CurrentUserView.as_view(), name="auth_me"),
    path("api/platform/ping/", platform_ping, name="platform_ping"),
    path("api/public/website-chat/<uuid:public_token>/", PublicWebsiteChatChannelView.as_view(), name="public_website_chat_channel"),
    path(
        "api/public/website-chat/<uuid:public_token>/conversations/",
        PublicWebsiteChatConversationCreateView.as_view(),
        name="public_website_chat_conversation_create",
    ),
    path(
        "api/public/website-chat/<uuid:public_token>/conversations/<uuid:conversation_id>/messages/",
        PublicWebsiteChatMessageCreateView.as_view(),
        name="public_website_chat_message_create",
    ),
    path("api/integrations/telegram/webhook/", TelegramWebhookView.as_view(), name="telegram_webhook"),
    path("api/ai/assistant/chat/", AIAssistantChatView.as_view(), name="ai_assistant_chat"),
    path("api/", include(router.urls)),
]
