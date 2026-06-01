from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.auth_views import ThrottledTokenObtainPairView, ThrottledTokenRefreshView
from apps.accounts.views import CurrentUserView, OwnerSignupView, PasswordResetConfirmView, PasswordResetRequestView, SocialAuthView
from apps.activities.views import ActivityEventViewSet, NoteViewSet, SegmentFilterViewSet, SegmentViewSet, TaggedObjectViewSet, TagViewSet
from apps.ai_core.views import (
    AIAnalystBriefView,
    AIAssistantChatView,
    AIAssistantStatusView,
    AIToolExecuteView,
    AIToolSuggestView,
    AIRequestLogViewSet,
    AgentProfileViewSet,
    ApprovalRequestViewSet,
    BusinessKnowledgeItemViewSet,
)
from apps.analytics.views import AnalyticsEventViewSet, ReportWidgetViewSet, ScheduledReportViewSet, owner_dashboard, report_export, report_summary
from apps.automations.views import AutomationActionViewSet, AutomationConditionViewSet, AutomationRuleViewSet, AutomationRunViewSet
from apps.billing.views import CurrentSubscriptionViewSet, EntitlementSummaryViewSet, SubscriptionPlanViewSet, UsageSummaryViewSet
from apps.bots.views import (
    BotChannelViewSet,
    BotConversationViewSet,
    BotMessageViewSet,
    BotViewSet,
    PublicWebsiteChatChannelView,
    PublicWebsiteChatConversationCreateView,
    PublicWebsiteChatMessageCreateView,
)
from apps.businesses.views import (
    BusinessMemberViewSet,
    BusinessInvitationViewSet,
    BusinessRoleViewSet,
    BusinessViewSet,
    RolePermissionViewSet,
    TeamMembershipViewSet,
    TeamMemberManagementViewSet,
    TeamViewSet,
    team_performance,
    team_permissions_catalog,
)
from apps.clients.views import ClientViewSet
from apps.conversations.inbox_views import InboxConversationViewSet
from apps.conversations.views import ConversationViewSet, MessageViewSet, QuickReplyTemplateViewSet
from apps.core.file_views import private_media_file
from apps.core.file_attachment_views import FileAttachmentViewSet
from apps.core.custom_field_views import CustomFieldDefinitionViewSet, CustomFieldValueViewSet
from apps.core.import_export_views import ImportJobViewSet, export_entity, import_template, manual_catalog_item, manual_sale
from apps.core.pilot_views import PilotReadinessView
from apps.core.platform_views import (
    platform_activate_landing,
    platform_merchants,
    platform_merchant_detail,
    platform_merchant_support_action,
    platform_overview,
    platform_operations_health_view,
)
from apps.core.security_views import SupportAccessGrantViewSet, security_audit, security_login_history, security_risk_summary
from apps.core.views import health, health_db, platform_ping, readiness
from apps.crm.views import DealViewSet, PipelineStageViewSet, PipelineViewSet, StageTransitionViewSet
from apps.integrations.views import (
    ApiTokenViewSet,
    BusinessConnectorViewSet,
    BusinessEventViewSet,
    ConnectorCredentialViewSet,
    ConnectorSyncRunViewSet,
    IntegrationEventLogViewSet,
    InstagramWebhookView,
    PublicApiClientsView,
    TelegramWebhookView,
    WebhookDeliveryLogViewSet,
    WebhookEndpointViewSet,
    WhatsAppWebhookView,
)
from apps.pricing.views import KaspiCompetitorOfferViewSet, KaspiPriceChangeLogViewSet, KaspiPricingAlertViewSet, KaspiPricingControlViewSet, KaspiPricingRecommendationViewSet, KaspiPricingRuleViewSet, PricingCatalogItemViewSet
from apps.leads.views import (
    LeadFormFieldViewSet,
    LeadFormSubmissionErrorViewSet,
    LeadFormSubmissionViewSet,
    LeadFormViewSet,
    LeadViewSet,
    PublicLeadFormSubmitView,
    PublicLeadFormView,
)
from apps.notifications.views import NotificationPreferenceViewSet, NotificationViewSet
from apps.onboarding.views import apply_onboarding_template, onboarding_demo_data, onboarding_first_message, onboarding_setup_channel, onboarding_status, onboarding_templates
from apps.outreach.views import OutreachCampaignViewSet, OutreachConsentViewSet, OutreachRecipientViewSet, OutreachTemplateViewSet
from apps.scheduling.views import AppointmentMessageSettingViewSet, AppointmentViewSet, ResourceViewSet, WorkingHoursViewSet
from apps.services.views import ServiceViewSet
from apps.tasks.views import TaskViewSet


router = DefaultRouter()
router.register("businesses", BusinessViewSet, basename="business")
router.register("business-members", BusinessMemberViewSet, basename="business-member")
router.register("team/members", TeamMemberManagementViewSet, basename="team-member")
router.register("team/invitations", BusinessInvitationViewSet, basename="team-invitation")
router.register("team/roles", BusinessRoleViewSet, basename="team-role")
router.register("team/role-permissions", RolePermissionViewSet, basename="team-role-permission")
router.register("team/departments", TeamViewSet, basename="team-department")
router.register("team/department-members", TeamMembershipViewSet, basename="team-department-member")
router.register("clients", ClientViewSet, basename="client")
router.register("pipelines", PipelineViewSet, basename="pipeline")
router.register("pipeline-stages", PipelineStageViewSet, basename="pipeline-stage")
router.register("stage-transitions", StageTransitionViewSet, basename="stage-transition")
router.register("deals", DealViewSet, basename="deal")
router.register("services", ServiceViewSet, basename="service")
router.register("leads", LeadViewSet, basename="lead")
router.register("lead-forms", LeadFormViewSet, basename="lead-form")
router.register("lead-form-fields", LeadFormFieldViewSet, basename="lead-form-field")
router.register("lead-form-submissions", LeadFormSubmissionViewSet, basename="lead-form-submission")
router.register("lead-form-submission-errors", LeadFormSubmissionErrorViewSet, basename="lead-form-submission-error")
router.register("resources", ResourceViewSet, basename="resource")
router.register("working-hours", WorkingHoursViewSet, basename="working-hours")
router.register("appointments", AppointmentViewSet, basename="appointment")
router.register("appointment-message-settings", AppointmentMessageSettingViewSet, basename="appointment-message-setting")
router.register("conversations", ConversationViewSet, basename="conversation")
router.register("messages", MessageViewSet, basename="message")
router.register("quick-replies", QuickReplyTemplateViewSet, basename="quick-reply")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("notification-preferences", NotificationPreferenceViewSet, basename="notification-preference")
router.register("outreach/templates", OutreachTemplateViewSet, basename="outreach-template")
router.register("outreach/campaigns", OutreachCampaignViewSet, basename="outreach-campaign")
router.register("outreach/recipients", OutreachRecipientViewSet, basename="outreach-recipient")
router.register("outreach/consents", OutreachConsentViewSet, basename="outreach-consent")
router.register("analytics-events", AnalyticsEventViewSet, basename="analytics-event")
router.register("report-widgets", ReportWidgetViewSet, basename="report-widget")
router.register("scheduled-reports", ScheduledReportViewSet, basename="scheduled-report")
router.register("activity-events", ActivityEventViewSet, basename="activity-event")
router.register("notes", NoteViewSet, basename="note")
router.register("tags", TagViewSet, basename="tag")
router.register("tagged-objects", TaggedObjectViewSet, basename="tagged-object")
router.register("segments", SegmentViewSet, basename="segment")
router.register("segment-filters", SegmentFilterViewSet, basename="segment-filter")
router.register("custom-fields", CustomFieldDefinitionViewSet, basename="custom-field")
router.register("custom-field-values", CustomFieldValueViewSet, basename="custom-field-value")
router.register("import-jobs", ImportJobViewSet, basename="import-job")
router.register("file-attachments", FileAttachmentViewSet, basename="file-attachment")
router.register("security/support-grants", SupportAccessGrantViewSet, basename="security-support-grant")
router.register("tasks", TaskViewSet, basename="task")
router.register("automation-rules", AutomationRuleViewSet, basename="automation-rule")
router.register("automation-conditions", AutomationConditionViewSet, basename="automation-condition")
router.register("automation-actions", AutomationActionViewSet, basename="automation-action")
router.register("automation-runs", AutomationRunViewSet, basename="automation-run")
router.register("billing/plans", SubscriptionPlanViewSet, basename="billing-plan")
router.register("billing/current-subscription", CurrentSubscriptionViewSet, basename="current-subscription")
router.register("billing/usage-summary", UsageSummaryViewSet, basename="usage-summary")
router.register("billing/entitlements", EntitlementSummaryViewSet, basename="billing-entitlement")
router.register("bots", BotViewSet, basename="bot")
router.register("bot-channels", BotChannelViewSet, basename="bot-channel")
router.register("bot-conversations", BotConversationViewSet, basename="bot-conversation")
router.register("bot-messages", BotMessageViewSet, basename="bot-message")
router.register("inbox/conversations", InboxConversationViewSet, basename="inbox-conversation")
router.register("ai/request-logs", AIRequestLogViewSet, basename="ai-request-log")
router.register("ai/knowledge-items", BusinessKnowledgeItemViewSet, basename="ai-knowledge-item")
router.register("ai/agent-profiles", AgentProfileViewSet, basename="ai-agent-profile")
router.register("ai/approval-requests", ApprovalRequestViewSet, basename="ai-approval-request")
router.register("integration-event-logs", IntegrationEventLogViewSet, basename="integration-event-log")
router.register("business-connectors", BusinessConnectorViewSet, basename="business-connector")
router.register("connector-credentials", ConnectorCredentialViewSet, basename="connector-credential")
router.register("business-events", BusinessEventViewSet, basename="business-event")
router.register("connector-sync-runs", ConnectorSyncRunViewSet, basename="connector-sync-run")
router.register("api-tokens", ApiTokenViewSet, basename="api-token")
router.register("webhook-endpoints", WebhookEndpointViewSet, basename="webhook-endpoint")
router.register("webhook-deliveries", WebhookDeliveryLogViewSet, basename="webhook-delivery")
router.register("pricing/kaspi/rules", KaspiPricingRuleViewSet, basename="kaspi-pricing-rule")
router.register("pricing/kaspi/catalog", PricingCatalogItemViewSet, basename="kaspi-pricing-catalog")
router.register("pricing/kaspi/control", KaspiPricingControlViewSet, basename="kaspi-pricing-control")
router.register("pricing/kaspi/alerts", KaspiPricingAlertViewSet, basename="kaspi-pricing-alert")
router.register("pricing/kaspi/competitor-offers", KaspiCompetitorOfferViewSet, basename="kaspi-competitor-offer")
router.register("pricing/kaspi/recommendations", KaspiPricingRecommendationViewSet, basename="kaspi-pricing-recommendation")
router.register("pricing/kaspi/change-logs", KaspiPriceChangeLogViewSet, basename="kaspi-price-change-log")

urlpatterns = [
    path("health/", health, name="health"),
    path("health/db/", health_db, name="health_db"),
    path("ready/", readiness, name="readiness"),
    path("admin/", admin.site.urls),
    path("api/auth/token/", ThrottledTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", ThrottledTokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/social/", SocialAuthView.as_view(), name="auth_social"),
    path("api/auth/signup/owner/", OwnerSignupView.as_view(), name="auth_signup_owner"),
    path("api/auth/password-reset/request/", PasswordResetRequestView.as_view(), name="auth_password_reset_request"),
    path("api/auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth_password_reset_confirm"),
    path("api/auth/me/", CurrentUserView.as_view(), name="auth_me"),
    path("api/team/permissions/catalog/", team_permissions_catalog, name="team_permissions_catalog"),
    path("api/team/performance/", team_performance, name="team_performance"),
    path("api/export/<str:entity_type>/", export_entity, name="export_entity"),
    path("api/import-templates/<str:entity_type>/", import_template, name="import_template"),
    path("api/data/sales/", manual_sale, name="manual_sale"),
    path("api/data/catalog-items/", manual_catalog_item, name="manual_catalog_item"),
    path("api/security/audit/", security_audit, name="security_audit"),
    path("api/security/login-history/", security_login_history, name="security_login_history"),
    path("api/security/risk-summary/", security_risk_summary, name="security_risk_summary"),
    path("api/analytics/owner-dashboard/", owner_dashboard, name="owner_dashboard"),
    path("api/analytics/reports/summary/", report_summary, name="analytics_report_summary"),
    path("api/analytics/reports/export/", report_export, name="analytics_report_export"),
    path("api/platform/ping/", platform_ping, name="platform_ping"),
    path("api/platform/overview/", platform_overview, name="platform_overview"),
    path("api/platform/operations-health/", platform_operations_health_view, name="platform_operations_health"),
    path("api/platform/merchants/", platform_merchants, name="platform_merchants"),
    path("api/platform/merchants/<int:business_id>/", platform_merchant_detail, name="platform_merchant_detail"),
    path("api/platform/merchants/<int:business_id>/support-actions/", platform_merchant_support_action, name="platform_merchant_support_action"),
    path("api/platform/activate-landing/", platform_activate_landing, name="platform_activate_landing"),
    path("api/pilot/readiness/", PilotReadinessView.as_view(), name="pilot_readiness"),
    path("api/onboarding/templates/", onboarding_templates, name="onboarding_templates"),
    path("api/onboarding/status/", onboarding_status, name="onboarding_status"),
    path("api/onboarding/apply-template/", apply_onboarding_template, name="apply_onboarding_template"),
    path("api/onboarding/demo-data/", onboarding_demo_data, name="onboarding_demo_data"),
    path("api/onboarding/setup-channel/", onboarding_setup_channel, name="onboarding_setup_channel"),
    path("api/onboarding/first-message/", onboarding_first_message, name="onboarding_first_message"),
    path("api/files/private/<path:file_path>/", private_media_file, name="private_media_file"),
    path("api/public/website-chat/<uuid:public_token>/", PublicWebsiteChatChannelView.as_view(), name="public_website_chat_channel"),
    path("api/public/forms/<uuid:public_id>/", PublicLeadFormView.as_view(), name="public_lead_form"),
    path("api/public/forms/<uuid:public_id>/submit/", PublicLeadFormSubmitView.as_view(), name="public_lead_form_submit"),
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
    path("api/integrations/whatsapp/webhook/", WhatsAppWebhookView.as_view(), name="whatsapp_webhook"),
    path("api/integrations/instagram/webhook/", InstagramWebhookView.as_view(), name="instagram_webhook"),
    path("api/public-api/clients/", PublicApiClientsView.as_view(), name="public_api_clients"),
    path("api/ai/assistant/status/", AIAssistantStatusView.as_view(), name="ai_assistant_status"),
    path("api/ai/assistant/chat/", AIAssistantChatView.as_view(), name="ai_assistant_chat"),
    path("api/ai/analyst/brief/", AIAnalystBriefView.as_view(), name="ai_analyst_brief"),
    path("api/ai/tools/suggest/", AIToolSuggestView.as_view(), name="ai_tools_suggest"),
    path("api/ai/tools/<int:log_id>/execute/", AIToolExecuteView.as_view(), name="ai_tools_execute"),
    path("api/", include(router.urls)),
]
