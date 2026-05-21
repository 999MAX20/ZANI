from django.conf import settings
from django.test import TestCase

from apps.ai_core.views import AIAssistantChatView
from apps.bots.views import PublicWebsiteChatChannelView, PublicWebsiteChatConversationCreateView, PublicWebsiteChatMessageCreateView
from apps.integrations.views import PublicApiClientsView, TelegramWebhookView, WhatsAppWebhookView
from apps.leads.views import PublicLeadFormSubmitView, PublicLeadFormView


class RateLimitScopeTests(TestCase):
    def test_public_perimeter_views_have_scoped_throttles(self):
        scoped_views = {
            PublicApiClientsView: "public_api",
            PublicLeadFormView: "public_form",
            PublicLeadFormSubmitView: "public_form",
            PublicWebsiteChatChannelView: "public_widget",
            PublicWebsiteChatConversationCreateView: "public_widget",
            PublicWebsiteChatMessageCreateView: "public_widget",
            TelegramWebhookView: "integration_webhook",
            WhatsAppWebhookView: "integration_webhook",
            AIAssistantChatView: "ai_assistant",
        }

        for view_class, scope in scoped_views.items():
            with self.subTest(view=view_class.__name__):
                self.assertEqual(view_class.throttle_scope, scope)
                self.assertTrue(view_class.throttle_classes)

    def test_required_rate_limit_scopes_are_configured(self):
        rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]

        for scope in ["auth_login", "auth_refresh", "public_api", "public_form", "public_widget", "integration_webhook", "ai_assistant"]:
            with self.subTest(scope=scope):
                self.assertIn(scope, rates)
                self.assertTrue(rates[scope])
