from datetime import time
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.taxonomy import ActivityEvents
from apps.ai_core.models import AIRequestLog, AgentProfile, BusinessKnowledgeItem
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.capabilities import apply_business_type_defaults
from apps.businesses.models import Business, BusinessCapability, BusinessMember
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.integrations.models import BusinessEvent
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.notifications.delivery import handle_appointment_followup_reply, process_due_notifications
from apps.scheduling.models import Appointment, AppointmentMessageSetting, Resource, WorkingHours
from apps.services.models import Service
from apps.tasks.models import Task


class BotsFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="bot-owner",
            email="bot-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="other-bot-owner",
            email="other-bot-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Bot Clinic", slug="bot-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Bot Clinic", slug="other-bot-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)

    def test_merchant_can_create_and_list_own_bot(self):
        self.api.force_authenticate(self.owner)

        create_response = self.api.post(
            "/api/bots/",
            {
                "business": self.business.id,
                "name": "Website assistant",
                "status": "draft",
                "default_language": "ru",
                "settings_json": {"tone": "friendly"},
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        list_response = self.api.get("/api/bots/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data["count"], 1)
        self.assertEqual(list_response.data["results"][0]["name"], "Website assistant")

    def test_merchant_cannot_create_bot_for_other_business(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/bots/",
            {"business": self.other_business.id, "name": "Foreign bot"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_bot_channels_are_tenant_filtered(self):
        own_bot = Bot.objects.create(business=self.business, name="Own bot")
        other_bot = Bot.objects.create(business=self.other_business, name="Other bot")
        BotChannel.objects.create(bot=own_bot, channel=BotChannel.Channels.WEBSITE)
        BotChannel.objects.create(bot=other_bot, channel=BotChannel.Channels.TELEGRAM)
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/bot-channels/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["bot"], own_bot.id)

    def test_bot_conversation_and_message_are_tenant_filtered(self):
        own_bot = Bot.objects.create(business=self.business, name="Own bot")
        other_bot = Bot.objects.create(business=self.other_business, name="Other bot")
        own_conversation = BotConversation.objects.create(
            business=self.business,
            bot=own_bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-1",
        )
        other_conversation = BotConversation.objects.create(
            business=self.other_business,
            bot=other_bot,
            channel=BotConversation.Channels.WHATSAPP,
            external_user_id="visitor-2",
        )
        BotMessage.objects.create(conversation=own_conversation, direction=BotMessage.Directions.INBOUND, text="Hello")
        BotMessage.objects.create(conversation=other_conversation, direction=BotMessage.Directions.INBOUND, text="Hidden")
        self.api.force_authenticate(self.owner)

        conversations_response = self.api.get("/api/bot-conversations/")
        messages_response = self.api.get("/api/bot-messages/")

        self.assertEqual(conversations_response.status_code, 200)
        self.assertEqual(messages_response.status_code, 200)
        self.assertEqual(conversations_response.data["count"], 1)
        self.assertEqual(messages_response.data["count"], 1)
        self.assertEqual(messages_response.data["results"][0]["text"], "Hello")

    def test_public_website_chat_creates_conversation_message_client_and_lead(self):
        bot = Bot.objects.create(business=self.business, name="Website bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Website Lead",
                "phone": "+77015550101",
                "message": "Хочу записаться",
                "external_user_id": "visitor-100",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(response.data["conversation_id"])
        self.assertIsNotNone(response.data["client_id"])
        self.assertIsNotNone(response.data["lead_id"])
        self.assertEqual(BotConversation.objects.count(), 1)
        self.assertEqual(BotMessage.objects.count(), 1)
        conversation = BotConversation.objects.get()
        self.assertEqual(conversation.business, self.business)
        self.assertEqual(conversation.client.full_name, "Website Lead")
        self.assertEqual(conversation.lead.source, "website")
        self.assertTrue(
            BusinessEvent.objects.filter(
                business=self.business,
                source=BotConversation.Channels.WEBSITE,
                event_type="lead.captured",
                payload_json__lead_id=conversation.lead_id,
            ).exists()
        )
        self.assertTrue(
            BusinessEvent.objects.filter(
                business=self.business,
                source=BotConversation.Channels.WEBSITE,
                event_type="message.received",
                payload_json__conversation_id=conversation.id,
            ).exists()
        )

    def test_public_website_chat_can_append_message_to_conversation(self):
        bot = Bot.objects.create(business=self.business, name="Website bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-100",
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/{conversation.public_id}/messages/",
            {"message": "Второе сообщение"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["conversation_id"], str(conversation.public_id))
        self.assertEqual(BotMessage.objects.count(), 1)
        self.assertTrue(
            BusinessEvent.objects.filter(
                business=self.business,
                source=BotConversation.Channels.WEBSITE,
                event_type="message.received",
                payload_json__conversation_id=conversation.id,
            ).exists()
        )
        self.assertEqual(BotMessage.objects.get().text, "Второе сообщение")

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
    def test_public_website_chat_auto_pipeline_lead_task_mode_is_guarded_and_idempotent(self):
        bot = Bot.objects.create(business=self.business, name="Website auto bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
            config_json={
                "auto_crm_pipeline": {
                    "enabled": True,
                    "mode": "lead_task",
                    "require_review_on_fallback": False,
                }
            },
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "message": "Здравствуйте, хочу записаться на консультацию",
                "external_user_id": "auto-visitor-100",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        conversation = BotConversation.objects.get(public_id=response.data["conversation_id"])
        self.assertIsNotNone(conversation.client_id)
        self.assertIsNotNone(conversation.lead_id)
        self.assertIsNone(conversation.deal_id)
        self.assertTrue(Task.objects.filter(business=self.business, client=conversation.client, lead=conversation.lead, deal__isnull=True).exists())
        auto_meta = conversation.metadata_json["auto_crm_pipeline"]
        self.assertEqual(auto_meta["status"], "created_lead_task")
        self.assertEqual(auto_meta["qualification"]["intent"], "appointment_request")
        self.assertEqual(auto_meta["confirmation_policy"]["mode"], "auto_lead_task")
        self.assertEqual(auto_meta["confirmation_policy"]["allowed_auto_actions"], ["create_client", "create_lead", "create_task"])

        second_response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/{conversation.public_id}/messages/",
            {"message": "И еще вопрос по цене"},
            format="json",
        )

        self.assertEqual(second_response.status_code, 201)
        conversation.refresh_from_db()
        self.assertEqual(Client.objects.filter(business=self.business).count(), 1)
        self.assertEqual(Lead.objects.filter(business=self.business, client=conversation.client).count(), 1)
        self.assertEqual(Task.objects.filter(business=self.business, client=conversation.client, lead=conversation.lead).count(), 1)

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
    def test_public_website_chat_auto_pipeline_suggest_only_mode_never_creates_crm_entities(self):
        bot = Bot.objects.create(business=self.business, name="Website suggest bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
            config_json={
                "auto_crm_pipeline": {
                    "enabled": True,
                    "confirmation_mode": "suggest_only",
                    "require_review_on_fallback": False,
                }
            },
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "message": "РҐРѕС‡Сѓ Р·Р°РїРёСЃР°С‚СЊСЃСЏ Рё СѓР·РЅР°С‚СЊ С†РµРЅСѓ",
                "external_user_id": "suggest-visitor-100",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        conversation = BotConversation.objects.get(public_id=response.data["conversation_id"])
        self.assertIsNone(conversation.client_id)
        self.assertIsNone(conversation.lead_id)
        self.assertIsNone(conversation.deal_id)
        self.assertFalse(Task.objects.filter(business=self.business).exists())
        auto_meta = conversation.metadata_json["auto_crm_pipeline"]
        self.assertEqual(auto_meta["status"], "qualified_only")
        self.assertEqual(auto_meta["confirmation_policy"]["mode"], "suggest_only")
        self.assertEqual(auto_meta["confirmation_policy"]["allowed_auto_actions"], [])
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type="auto_pipeline_qualified_only",
                metadata__confirmation_policy__mode="suggest_only",
            ).exists()
        )

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
    def test_public_website_chat_auto_pipeline_can_sell_and_create_draft_deal(self):
        bot = Bot.objects.create(business=self.business, name="Website sales bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
            config_json={
                "auto_crm_pipeline": {
                    "enabled": True,
                    "mode": "draft_deal",
                    "require_review_on_fallback": False,
                    "min_deal_confidence": 0.7,
                    "auto_send_reply": True,
                }
            },
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Sales Visitor",
                "phone": "+77015550111",
                "message": "Здравствуйте, хочу записаться на консультацию и узнать цену",
                "external_user_id": "sales-visitor-100",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        conversation = BotConversation.objects.get(public_id=response.data["conversation_id"])
        self.assertIsNotNone(conversation.client_id)
        self.assertIsNotNone(conversation.lead_id)
        self.assertIsNotNone(conversation.deal_id)
        self.assertTrue(Deal.objects.filter(business=self.business, client=conversation.client, lead=conversation.lead).exists())
        self.assertTrue(Task.objects.filter(business=self.business, client=conversation.client, lead=conversation.lead, deal=conversation.deal).exists())
        auto_reply = BotMessage.objects.filter(
            conversation=conversation,
            direction=BotMessage.Directions.OUTBOUND,
            sender_type=BotMessage.SenderTypes.BOT,
        ).first()
        self.assertIsNotNone(auto_reply)
        self.assertTrue(auto_reply.text)
        self.assertTrue(auto_reply.payload_json["auto_crm_pipeline"])
        auto_meta = conversation.metadata_json["auto_crm_pipeline"]
        self.assertEqual(auto_meta["status"], "created_draft_deal")
        self.assertEqual(auto_meta["auto_reply"]["message_id"], auto_reply.id)
        self.assertEqual(auto_meta["confirmation_policy"]["mode"], "draft_deal")
        self.assertEqual(
            auto_meta["confirmation_policy"]["allowed_auto_actions"],
            ["create_client", "create_lead", "create_task", "create_draft_deal"],
        )

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
    def test_auto_pipeline_respects_agent_allowed_tools_for_deals(self):
        bot = Bot.objects.create(business=self.business, name="Website guarded bot", status=Bot.Statuses.ACTIVE)
        AgentProfile.objects.create(
            business=self.business,
            bot=bot,
            name="Lead only profile",
            allowed_tools_json={"tools": ["create_lead", "create_task", "handoff_to_manager"]},
        )
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
            config_json={
                "auto_crm_pipeline": {
                    "enabled": True,
                    "mode": "draft_deal",
                    "require_review_on_fallback": False,
                    "min_deal_confidence": 0.7,
                }
            },
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Guarded Visitor",
                "phone": "+77015550112",
                "message": "Здравствуйте, хочу записаться на консультацию и узнать цену",
                "external_user_id": "guarded-visitor-100",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        conversation = BotConversation.objects.get(public_id=response.data["conversation_id"])
        self.assertIsNotNone(conversation.client_id)
        self.assertIsNotNone(conversation.lead_id)
        self.assertIsNone(conversation.deal_id)
        self.assertFalse(Deal.objects.filter(business=self.business, client=conversation.client).exists())
        self.assertEqual(conversation.metadata_json["auto_crm_pipeline"]["status"], "created_lead_task")
        self.assertEqual(conversation.metadata_json["auto_crm_pipeline"]["reason"], "Deal creation is disabled by the active agent profile.")
        self.assertNotIn(
            "create_draft_deal",
            conversation.metadata_json["auto_crm_pipeline"]["confirmation_policy"]["allowed_auto_actions"],
        )

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
    def test_auto_pipeline_respects_disabled_deals_capability(self):
        apply_business_type_defaults(self.business, configured_by=self.owner)
        capability = BusinessCapability.objects.get(business=self.business, module_key="deals")
        capability.is_enabled = False
        capability.save(update_fields=["is_enabled", "updated_at"])
        if hasattr(self.business, "_capability_map"):
            del self.business._capability_map
        bot = Bot.objects.create(business=self.business, name="Capability guarded bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
            config_json={
                "auto_crm_pipeline": {
                    "enabled": True,
                    "mode": "draft_deal",
                    "require_review_on_fallback": False,
                    "min_deal_confidence": 0.7,
                }
            },
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Capability Guarded Visitor",
                "phone": "+77015550113",
                "message": "Здравствуйте, хочу записаться на консультацию и узнать цену",
                "external_user_id": "capability-guarded-visitor-100",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        conversation = BotConversation.objects.get(public_id=response.data["conversation_id"])
        self.assertIsNotNone(conversation.client_id)
        self.assertIsNotNone(conversation.lead_id)
        self.assertIsNone(conversation.deal_id)
        self.assertFalse(Deal.objects.filter(business=self.business, client=conversation.client).exists())
        auto_meta = conversation.metadata_json["auto_crm_pipeline"]
        self.assertEqual(auto_meta["status"], "created_lead_task")
        self.assertEqual(auto_meta["reason"], "Deal creation is disabled for this business.")
        self.assertNotIn("create_draft_deal", auto_meta["confirmation_policy"]["allowed_auto_actions"])

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
    def test_handoff_conversation_skips_auto_pipeline_and_bot_reply(self):
        bot = Bot.objects.create(business=self.business, name="Handoff guarded bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
            config_json={
                "auto_crm_pipeline": {
                    "enabled": True,
                    "mode": "draft_deal",
                    "require_review_on_fallback": False,
                    "min_deal_confidence": 0.7,
                    "auto_send_reply": True,
                }
            },
        )
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="handoff-visitor-100",
            handoff_required=True,
            handoff_reason="manager takeover",
            bot_enabled=False,
        )
        ai_count_before = AIRequestLog.objects.filter(business=self.business, prompt_type="conversation_qualification").count()

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/{conversation.public_id}/messages/",
            {"message": "РќСѓР¶РЅР° Р·Р°РїРёСЃСЊ Рё С†РµРЅР°"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        conversation.refresh_from_db()
        self.assertIsNone(conversation.client_id)
        self.assertIsNone(conversation.lead_id)
        self.assertIsNone(conversation.deal_id)
        self.assertFalse(Task.objects.filter(business=self.business).exists())
        self.assertFalse(
            BotMessage.objects.filter(
                conversation=conversation,
                direction=BotMessage.Directions.OUTBOUND,
                sender_type=BotMessage.SenderTypes.BOT,
            ).exists()
        )
        self.assertEqual(AIRequestLog.objects.filter(business=self.business, prompt_type="conversation_qualification").count(), ai_count_before)
        self.assertEqual(conversation.metadata_json["auto_crm_pipeline"]["status"], "skipped_handoff")
        self.assertEqual(conversation.metadata_json["auto_crm_pipeline"]["confirmation_policy"]["mode"], "draft_deal")
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type="auto_pipeline_skipped_handoff",
                metadata__conversation_id=conversation.id,
            ).exists()
        )

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
    def test_auto_sales_reply_receives_playbook_prices_resources_and_slots(self):
        self.business.business_type = Business.BusinessTypes.DENTISTRY
        self.business.save(update_fields=["business_type", "updated_at"])
        Service.objects.create(
            business=self.business,
            name="Консультация стоматолога",
            duration_minutes=60,
            price_from=15000,
        )
        resource = Resource.objects.create(business=self.business, name="Айгерим", resource_type=Resource.ResourceTypes.STAFF)
        today = timezone.localdate()
        WorkingHours.objects.create(
            business=self.business,
            resource=resource,
            weekday=today.weekday(),
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        bot = Bot.objects.create(business=self.business, name="Dentistry sales bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
            config_json={
                "auto_crm_pipeline": {
                    "enabled": True,
                    "mode": "draft_deal",
                    "require_review_on_fallback": False,
                    "min_deal_confidence": 0.7,
                    "auto_send_reply": True,
                }
            },
        )

        response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Dental Visitor",
                "phone": "+77015550222",
                "message": "Хочу записаться на консультацию стоматолога к Айгерим, какая цена?",
                "external_user_id": "dental-visitor-100",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        log = AIRequestLog.objects.filter(prompt_type="bot_suggest_reply").latest("id")
        scheduling = log.input_json["scheduling_context"]
        playbook = log.input_json["sales_playbook"]
        self.assertEqual(playbook["business_type"], Business.BusinessTypes.DENTISTRY)
        self.assertEqual(scheduling["matched_service"]["name"], "Консультация стоматолога")
        self.assertEqual(scheduling["matched_service"]["price_from"], "15000.00")
        self.assertEqual(scheduling["matched_resource"]["name"], "Айгерим")
        self.assertTrue(scheduling["next_available_slots"])

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
    def test_auto_pipeline_books_appointment_when_client_selects_offered_slot(self):
        service = Service.objects.create(
            business=self.business,
            name="Консультация стоматолога",
            duration_minutes=60,
            price_from=15000,
        )
        resource = Resource.objects.create(business=self.business, name="Айгерим", resource_type=Resource.ResourceTypes.STAFF)
        today = timezone.localdate()
        WorkingHours.objects.create(
            business=self.business,
            resource=resource,
            weekday=today.weekday(),
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        bot = Bot.objects.create(business=self.business, name="Booking sales bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
            config_json={
                "auto_crm_pipeline": {
                    "enabled": True,
                    "confirmation_mode": "appointment_explicit",
                    "require_review_on_fallback": False,
                    "auto_send_reply": True,
                }
            },
        )

        first_response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Booking Visitor",
                "phone": "+77015550333",
                "message": "Хочу записаться на консультацию стоматолога к Айгерим",
                "external_user_id": "booking-visitor-100",
            },
            format="json",
        )
        self.assertEqual(first_response.status_code, 201)
        conversation = BotConversation.objects.get(public_id=first_response.data["conversation_id"])
        self.assertTrue(conversation.metadata_json["auto_booking"]["offered_slots"])
        auto_meta = conversation.metadata_json["auto_crm_pipeline"]
        self.assertEqual(auto_meta["confirmation_policy"]["mode"], "appointment_explicit")
        self.assertEqual(auto_meta["confirmation_policy"]["requires_explicit_confirmation"], ["create_appointment"])
        self.assertEqual(auto_meta["confirmation_policy"]["appointment_confirmation_mode"], "client_selected_offered_slot")
        self.assertFalse(Appointment.objects.filter(business=self.business, client=conversation.client).exists())

        second_response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/{conversation.public_id}/messages/",
            {"message": "1 вариант подходит"},
            format="json",
        )

        self.assertEqual(second_response.status_code, 201)
        conversation.refresh_from_db()
        appointment = Appointment.objects.get(business=self.business, client=conversation.client, lead=conversation.lead)
        self.assertEqual(appointment.service, service)
        self.assertEqual(appointment.resource, resource)
        self.assertEqual(appointment.source, Appointment.Sources.WEBSITE)
        self.assertEqual(conversation.metadata_json["auto_booking"]["status"], "booked")
        self.assertEqual(conversation.metadata_json["auto_booking"]["appointment_id"], appointment.id)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=conversation.client,
                event_type=ActivityEvents.APPOINTMENT_CREATED,
                entity_type="Lead",
                entity_id=str(conversation.lead_id),
                metadata__lifecycle_action="lead_appointment_created",
                metadata__conversation_id=conversation.id,
            ).exists()
        )
        self.assertTrue(Notification.objects.filter(business=self.business, appointment=appointment, action_label="Подтвердить запись").exists())
        self.assertTrue(
            BotMessage.objects.filter(
                conversation=conversation,
                direction=BotMessage.Directions.OUTBOUND,
                sender_type=BotMessage.SenderTypes.BOT,
                text__contains="Готово, записали",
            ).exists()
        )

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
    def test_auto_booking_runs_appointment_message_delivery_and_confirmation_reply(self):
        service = Service.objects.create(
            business=self.business,
            name="Консультация",
            duration_minutes=60,
            price_from=12000,
        )
        resource = Resource.objects.create(business=self.business, name="Мастер Алия", resource_type=Resource.ResourceTypes.STAFF)
        tomorrow = timezone.localdate() + timezone.timedelta(days=1)
        WorkingHours.objects.create(
            business=self.business,
            resource=resource,
            weekday=tomorrow.weekday(),
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        AppointmentMessageSetting.objects.create(
            business=self.business,
            scenario=AppointmentMessageSetting.Scenarios.CONFIRMATION,
            label="Подтвердить запись",
            is_enabled=True,
            offset_minutes=-180,
            channel_policy=AppointmentMessageSetting.ChannelPolicies.SYSTEM,
            template_text="Боевой тест: {client_name}, подтвердите {service_name}{resource_text} {date} в {time}.",
        )
        AppointmentMessageSetting.objects.create(
            business=self.business,
            scenario=AppointmentMessageSetting.Scenarios.REMINDER,
            label="Напомнить о записи",
            is_enabled=True,
            offset_minutes=-60,
            channel_policy=AppointmentMessageSetting.ChannelPolicies.SYSTEM,
            template_text="Напоминание: {service_name} в {time}.",
        )
        bot = Bot.objects.create(business=self.business, name="Battle booking bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
            config_json={
                "auto_crm_pipeline": {
                    "enabled": True,
                    "mode": "draft_deal",
                    "require_review_on_fallback": False,
                    "min_deal_confidence": 0.7,
                    "auto_send_reply": True,
                    "create_appointment": True,
                }
            },
        )

        first_response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Battle Client",
                "phone": "+77015550444",
                "message": "Хочу записаться на консультацию к Мастер Алия",
                "external_user_id": "battle-visitor-100",
            },
            format="json",
        )
        self.assertEqual(first_response.status_code, 201)
        conversation = BotConversation.objects.get(public_id=first_response.data["conversation_id"])
        self.assertTrue(conversation.metadata_json["auto_booking"]["offered_slots"])

        second_response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/{conversation.public_id}/messages/",
            {"message": "Первый вариант подходит"},
            format="json",
        )
        self.assertEqual(second_response.status_code, 201)

        conversation.refresh_from_db()
        appointment = Appointment.objects.get(business=self.business, client=conversation.client, lead=conversation.lead)
        confirmation = Notification.objects.get(appointment=appointment, action_label="Подтвердить запись")
        reminder = Notification.objects.get(appointment=appointment, action_label="Напомнить о записи")
        self.assertEqual(confirmation.channel, Notification.Channels.SYSTEM)
        self.assertIn("Боевой тест: Battle Client", confirmation.text)
        self.assertEqual(reminder.channel, Notification.Channels.SYSTEM)

        confirmation.send_at = timezone.now() - timezone.timedelta(minutes=1)
        confirmation.save(update_fields=["send_at", "updated_at"])
        delivery_results = process_due_notifications()
        confirmation.refresh_from_db()
        self.assertEqual(delivery_results[0]["status"], "sent")
        self.assertEqual(confirmation.status, Notification.Statuses.SENT)

        conversation.client.telegram_id = "battle-client-tg"
        conversation.client.save(update_fields=["telegram_id", "updated_at"])
        reply_result = handle_appointment_followup_reply(
            business=self.business,
            channel=Notification.Channels.TELEGRAM,
            external_user_id="battle-client-tg",
            text="Да",
        )
        appointment.refresh_from_db()
        self.assertEqual(reply_result["status"], "confirmed")
        self.assertEqual(appointment.status, Appointment.Statuses.CONFIRMED)

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")
    def test_crm_pipeline_runtime_check_command_passes_in_safe_mode(self):
        output = StringIO()

        call_command("crm_pipeline_runtime_check", "--json", stdout=output)

        payload = output.getvalue()
        self.assertIn('"ok": true', payload)
        self.assertIn('"client reply confirms appointment"', payload)

    def test_public_website_chat_rejects_non_website_channel(self):
        bot = Bot.objects.create(business=self.business, name="Telegram bot", status=Bot.Statuses.ACTIVE)
        channel = BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.TELEGRAM,
            status=BotChannel.Statuses.ACTIVE,
        )

        response = self.api.get(f"/api/public/website-chat/{channel.public_token}/")

        self.assertEqual(response.status_code, 404)

    @override_settings(OPENAI_API_KEY="")
    def test_suggest_reply_returns_suggestion_without_sending_message(self):
        BusinessKnowledgeItem.objects.create(
            business=self.business,
            title="Booking policy",
            content="Offer two nearest appointment slots.",
            category="bot",
        )
        bot = Bot.objects.create(business=self.business, name="Website bot", status=Bot.Statuses.ACTIVE)
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-100",
        )
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Можно записаться сегодня?",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-conversations/{conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_mock"])
        self.assertIn("suggested_reply", response.data)
        self.assertEqual(BotMessage.objects.count(), 1)
        log = AIRequestLog.objects.get(prompt_type="bot_suggest_reply")
        self.assertEqual(log.business, self.business)
        self.assertEqual(log.source, AIRequestLog.Sources.BOT)
        self.assertEqual(log.input_json["conversation_id"], conversation.id)
        self.assertEqual(log.input_json["context"][0]["title"], "Booking policy")

    @override_settings(OPENAI_API_KEY="")
    def test_suggest_reply_uses_bot_agent_profile_when_present(self):
        bot = Bot.objects.create(business=self.business, name="Website bot", status=Bot.Statuses.ACTIVE)
        AgentProfile.objects.create(
            business=self.business,
            bot=bot,
            name="Clinic sales agent",
            role_description="Qualify leads and offer appointment slots.",
            tone=AgentProfile.Tones.SALES,
            language="ru",
            system_prompt="Always be concise.",
        )
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-agent",
        )
        BotMessage.objects.create(conversation=conversation, direction=BotMessage.Directions.INBOUND, text="Хочу записаться")
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-conversations/{conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 200)
        log = AIRequestLog.objects.get(prompt_type="bot_suggest_reply")
        self.assertEqual(log.input_json["agent_profile"]["name"], "Clinic sales agent")
        self.assertIn("Clinic sales agent", log.input_json["user_input"])

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="")
    def test_suggest_reply_uses_bot_model_settings_and_allowed_tools(self):
        bot = Bot.objects.create(
            business=self.business,
            name="Configured bot",
            status=Bot.Statuses.ACTIVE,
            settings_json={"model": "merchant-model", "temperature": 0.2},
        )
        AgentProfile.objects.create(
            business=self.business,
            bot=bot,
            name="Configured profile",
            allowed_tools_json={"tools": ["create_lead", "handoff_to_manager"]},
        )
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="configured-visitor",
        )
        BotMessage.objects.create(conversation=conversation, direction=BotMessage.Directions.INBOUND, text="Хочу записаться")
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-conversations/{conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["model"], "merchant-model")
        log = AIRequestLog.objects.get(prompt_type="bot_suggest_reply")
        self.assertEqual(log.model, "merchant-model")
        self.assertEqual(log.input_json["ai_temperature"], 0.2)
        self.assertEqual(log.input_json["agent_profile"]["allowed_tools_json"]["tools"], ["create_lead", "handoff_to_manager"])
        self.assertEqual(log.input_json["bot_settings"]["model"], "merchant-model")

    @override_settings(OPENAI_API_KEY="")
    def test_suggest_reply_rejects_foreign_conversation(self):
        bot = Bot.objects.create(business=self.other_business, name="Other bot", status=Bot.Statuses.ACTIVE)
        conversation = BotConversation.objects.create(
            business=self.other_business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-200",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-conversations/{conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 404)


class InboxBackendTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="inbox-owner",
            email="inbox-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.manager = User.objects.create_user(
            username="inbox-manager",
            email="inbox-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        self.other_owner = User.objects.create_user(
            username="other-inbox-owner",
            email="other-inbox-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.platform_user = User.objects.create_user(
            username="inbox-platform",
            email="inbox-platform@example.com",
            password="pass",
            role=User.Roles.PLATFORM_ADMIN,
        )
        self.business = Business.objects.create(owner=self.owner, name="Inbox Clinic", slug="inbox-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Inbox", slug="other-inbox")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.manager, role=BusinessMember.Roles.MANAGER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.bot = Bot.objects.create(business=self.business, name="Inbox bot", status=Bot.Statuses.ACTIVE)
        self.other_bot = Bot.objects.create(business=self.other_business, name="Other inbox bot", status=Bot.Statuses.ACTIVE)
        self.client = self.business.clients.create(full_name="Алия Иванова", phone="+77015550101", email="aliya@example.com")
        self.conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="visitor-1",
            client=self.client,
            priority=BotConversation.Priorities.HIGH,
        )
        self.other_conversation = BotConversation.objects.create(
            business=self.other_business,
            bot=self.other_bot,
            channel=BotConversation.Channels.TELEGRAM,
            external_user_id="visitor-2",
        )

    def test_inbox_summary_returns_channel_health_and_pilot_positioning(self):
        BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Нужно записаться",
        )
        self.conversation.handoff_required = True
        self.conversation.bot_enabled = False
        self.conversation.unread_count = 1
        self.conversation.save(update_fields=["handoff_required", "bot_enabled", "unread_count", "updated_at"])
        BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.TELEGRAM,
            external_user_id="telegram-user",
        )
        BotConversation.objects.create(
            business=self.other_business,
            bot=self.other_bot,
            channel=BotConversation.Channels.WHATSAPP,
            external_user_id="hidden-whatsapp",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/inbox/conversations/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(response.data["unread"], 1)
        self.assertEqual(response.data["unread_messages"], 1)
        self.assertEqual(response.data["handoff_required"], 1)
        self.assertEqual(response.data["bot_paused"], 1)
        channels = {item["key"]: item for item in response.data["channels"]}
        self.assertEqual(channels["website"]["total"], 1)
        self.assertEqual(channels["telegram"]["total"], 1)
        self.assertEqual(channels["whatsapp"]["status"], "roadmap")
        self.assertEqual(channels["instagram"]["status"], "roadmap")
        self.assertTrue(response.data["next_actions"])
        self.assertIn("roadmap", response.data["pilot_positioning"])

    def test_inbox_summary_is_tenant_safe(self):
        BotConversation.objects.create(
            business=self.other_business,
            bot=self.other_bot,
            channel=BotConversation.Channels.WHATSAPP,
            external_user_id="hidden-whatsapp",
            priority=BotConversation.Priorities.URGENT,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/inbox/conversations/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["urgent"], 0)
        channels = {item["key"]: item for item in response.data["channels"]}
        self.assertEqual(channels["whatsapp"]["total"], 0)

    def test_inbox_can_filter_unassigned_conversations(self):
        assigned = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="assigned-visitor",
            assigned_to=self.manager,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/inbox/conversations/?assigned_to=unassigned")

        self.assertEqual(response.status_code, 200)
        ids = {item["id"] for item in response.data["results"]}
        self.assertIn(self.conversation.id, ids)
        self.assertNotIn(assigned.id, ids)

    def test_inbox_conversations_are_tenant_filtered(self):
        BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Need consultation",
        )
        BotMessage.objects.create(
            conversation=self.other_conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Hidden message",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/inbox/conversations/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.conversation.id)

    def test_platform_and_anonymous_users_cannot_open_merchant_inbox(self):
        self.api.force_authenticate(self.platform_user)
        platform_response = self.api.get("/api/inbox/conversations/")
        self.api.force_authenticate(None)
        anonymous_response = self.api.get("/api/inbox/conversations/")

        self.assertEqual(platform_response.status_code, 403)
        self.assertIn(anonymous_response.status_code, [401, 403])

    def test_bot_message_api_updates_inbox_timestamps_and_unread_counter(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/bot-messages/",
            {
                "conversation": self.conversation.id,
                "direction": BotMessage.Directions.INBOUND,
                "sender_type": BotMessage.SenderTypes.CLIENT,
                "text": "Можно записаться?",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.unread_count, 1)
        self.assertIsNotNone(self.conversation.last_message_at)
        self.assertIsNotNone(self.conversation.last_inbound_at)
        self.assertFalse(Notification.objects.filter(business=self.business, recipient=self.owner, action_url__contains="/app/conversations").exists())
        manager_notification = Notification.objects.get(business=self.business, recipient=self.manager, action_url__contains="/app/conversations")
        self.assertIn("Можно записаться?", manager_notification.text)

        inbox_response = self.api.get("/api/inbox/conversations/?unread=true&search=записаться")
        self.assertEqual(inbox_response.status_code, 200)
        self.assertEqual(inbox_response.data["count"], 1)

        owner_summary = self.api.get("/api/notifications/summary/")
        self.assertEqual(owner_summary.data["unread"], 0)
        self.api.force_authenticate(self.manager)
        manager_summary = self.api.get("/api/notifications/summary/")
        self.assertEqual(manager_summary.data["unread"], 1)

    def test_assigned_inbound_chat_notification_only_goes_to_assignee(self):
        operator = User.objects.create_user(
            username="inbox-operator",
            email="inbox-operator@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OPERATOR,
        )
        BusinessMember.objects.create(business=self.business, user=operator, role=BusinessMember.Roles.OPERATOR)
        self.conversation.assigned_to = self.manager
        self.conversation.save(update_fields=["assigned_to", "updated_at"])
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/bot-messages/",
            {
                "conversation": self.conversation.id,
                "direction": BotMessage.Directions.INBOUND,
                "sender_type": BotMessage.SenderTypes.CLIENT,
                "text": "Проверьте запись",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Notification.objects.filter(business=self.business, recipient=self.manager).exists())
        self.assertFalse(Notification.objects.filter(business=self.business, recipient=operator).exists())

    def test_inbox_messages_assign_handoff_and_mark_read_actions_work(self):
        self.api.force_authenticate(self.owner)
        message_response = self.api.post(
            "/api/bot-messages/",
            {
                "conversation": self.conversation.id,
                "direction": BotMessage.Directions.INBOUND,
                "sender_type": BotMessage.SenderTypes.CLIENT,
                "text": "Hello inbox",
            },
            format="json",
        )
        self.assertEqual(message_response.status_code, 201)

        messages_response = self.api.get(f"/api/inbox/conversations/{self.conversation.id}/messages/")
        self.assertEqual(messages_response.status_code, 200)
        self.assertEqual(messages_response.data["count"], 1)
        self.assertEqual(len(messages_response.data["results"]), 1)
        self.assertEqual(messages_response.data["results"][0]["text"], "Hello inbox")

        assign_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/assign/",
            {"user_id": self.manager.id},
            format="json",
        )
        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(assign_response.data["assigned_to"], self.manager.id)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type="conversation_assigned",
                metadata__conversation_id=self.conversation.id,
                metadata__to_user_id=self.manager.id,
            ).exists()
        )

        handoff_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/handoff/",
            {"reason": "Manager review"},
            format="json",
        )
        self.assertEqual(handoff_response.status_code, 200)
        self.assertTrue(handoff_response.data["handoff_required"])
        self.assertFalse(handoff_response.data["bot_enabled"])
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type="conversation_handoff_requested",
                metadata__conversation_id=self.conversation.id,
                metadata__reason="Manager review",
            ).exists()
        )

        handoff_filter_response = self.api.get("/api/inbox/conversations/?handoff_required=true&q=Hello")
        self.assertEqual(handoff_filter_response.status_code, 200)
        self.assertEqual(handoff_filter_response.data["count"], 1)

        mark_read_response = self.api.post(f"/api/inbox/conversations/{self.conversation.id}/mark-read/")
        self.assertEqual(mark_read_response.status_code, 200)
        self.assertEqual(mark_read_response.data["unread_count"], 0)

    def test_bot_message_payload_secrets_are_masked_in_api_responses(self):
        message = BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="secret payload",
            payload_json={"api_key": "raw-api-key", "nested": {"access_token": "raw-access-token"}, "visible": "ok"},
        )
        self.api.force_authenticate(self.owner)

        bot_message_response = self.api.get(f"/api/bot-messages/{message.id}/")
        inbox_response = self.api.get(f"/api/inbox/conversations/{self.conversation.id}/messages/")

        self.assertEqual(bot_message_response.status_code, 200)
        self.assertEqual(inbox_response.status_code, 200)
        self.assertEqual(bot_message_response.data["payload_json"]["api_key"], "configured")
        self.assertEqual(inbox_response.data["results"][0]["payload_json"]["nested"]["access_token"], "configured")
        self.assertEqual(bot_message_response.data["payload_json"]["visible"], "ok")
        self.assertNotIn("raw-api-key", str(bot_message_response.data))
        self.assertNotIn("raw-access-token", str(inbox_response.data))

    def test_manager_can_send_outbound_message_from_inbox(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/messages/",
            {"text": "Здравствуйте, можем записать вас на завтра", "sender_type": "manager"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["direction"], BotMessage.Directions.OUTBOUND)
        self.assertEqual(response.data["sender_type"], BotMessage.SenderTypes.MANAGER)
        self.assertEqual(response.data["status"], BotMessage.Statuses.FAILED)
        self.assertEqual(response.data["error_text"], "Channel provider is not connected.")
        self.assertEqual(response.data["delivery_attempts"], 1)
        self.conversation.refresh_from_db()
        self.assertIsNotNone(self.conversation.last_outbound_at)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type=ActivityEvents.MESSAGE_SENT,
                entity_id=str(response.data["id"]),
                metadata__event_type=ActivityEvents.MESSAGE_SENT,
                metadata__conversation_id=self.conversation.id,
            ).exists()
        )

    def test_manager_can_retry_unsent_outbound_message_from_inbox(self):
        self.api.force_authenticate(self.owner)
        original = BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.OUTBOUND,
            sender_type=BotMessage.SenderTypes.MANAGER,
            text="Повторить отправку",
            status=BotMessage.Statuses.FAILED,
            error_text="Provider delivery failed.",
        )

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/retry-message/",
            {"message_id": original.id},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["direction"], BotMessage.Directions.OUTBOUND)
        self.assertEqual(response.data["text"], original.text)
        self.assertEqual(response.data["payload_json"]["retry_of_message_id"], original.id)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type=ActivityEvents.MESSAGE_RETRIED,
                metadata__event_type=ActivityEvents.MESSAGE_RETRIED,
                metadata__conversation_id=self.conversation.id,
                metadata__original_message_id=original.id,
                metadata__retried_message_id=response.data["id"],
            ).exists()
        )

    def test_inbox_provider_delivery_errors_are_sanitized(self):
        BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )
        self.api.force_authenticate(self.owner)

        with patch(
            "apps.bots.outbound_delivery.send_message",
            return_value={
                "ok": False,
                "mock": False,
                "retryable": False,
                "reason": "provider failed token=raw-secret access_token=raw-access Authorization Bearer raw-bearer",
                "nested": {"api_key": "raw-api-key"},
            },
        ):
            response = self.api.post(
                f"/api/inbox/conversations/{self.conversation.id}/messages/",
                {"text": "Retry with provider", "sender_type": "manager"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], BotMessage.Statuses.FAILED)
        serialized = str(response.data)
        self.assertNotIn("raw-secret", serialized)
        self.assertNotIn("raw-access", serialized)
        self.assertNotIn("raw-bearer", serialized)
        self.assertNotIn("raw-api-key", serialized)
        self.assertIn("[redacted]", response.data["error_text"])
        self.assertEqual(response.data["payload_json"]["provider_result"]["nested"]["api_key"], "configured")

    def test_outbound_message_is_persisted_before_provider_call(self):
        BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )
        self.api.force_authenticate(self.owner)

        def provider_send(channel, recipient_id, text, payload=None):
            stored = BotMessage.objects.get(id=payload["zani_message_id"])
            self.assertEqual(stored.status, BotMessage.Statuses.DELIVERING)
            self.assertEqual(stored.text, "Persist before provider")
            return {"ok": True, "mock": False, "provider_message_id": "provider-42"}

        with patch("apps.bots.outbound_delivery.send_message", side_effect=provider_send):
            response = self.api.post(
                f"/api/inbox/conversations/{self.conversation.id}/messages/",
                {"text": "Persist before provider", "sender_type": "manager"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], BotMessage.Statuses.SENT)
        self.assertEqual(response.data["external_message_id"], "provider-42")
        self.assertEqual(response.data["delivery_attempts"], 1)

    def test_outbound_send_idempotency_replays_exact_request_and_rejects_mismatch(self):
        self.api.force_authenticate(self.owner)
        headers = {"HTTP_IDEMPOTENCY_KEY": "send-once-1"}

        first = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/messages/",
            {"text": "Only once", "sender_type": "manager"},
            format="json",
            **headers,
        )
        replay = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/messages/",
            {"text": "Only once", "sender_type": "manager"},
            format="json",
            **headers,
        )
        mismatch = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/messages/",
            {"text": "Different payload", "sender_type": "manager"},
            format="json",
            **headers,
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.data["id"], first.data["id"])
        self.assertEqual(mismatch.status_code, 400)
        self.assertEqual(
            BotMessage.objects.filter(
                conversation=self.conversation,
                delivery_idempotency_key="send-once-1",
            ).count(),
            1,
        )

    def test_transient_provider_failure_is_scheduled_with_bounded_backoff(self):
        BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )
        self.api.force_authenticate(self.owner)

        with patch(
            "apps.bots.outbound_delivery.send_message",
            side_effect=TimeoutError("provider timeout"),
        ):
            response = self.api.post(
                f"/api/inbox/conversations/{self.conversation.id}/messages/",
                {"text": "Retry later", "sender_type": "manager"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], BotMessage.Statuses.RETRY_SCHEDULED)
        self.assertEqual(response.data["delivery_attempts"], 1)
        self.assertIsNotNone(response.data["delivery_next_retry_at"])

    @override_settings(OUTBOUND_DELIVERY_MAX_ATTEMPTS=1)
    def test_transient_provider_failure_becomes_terminal_at_attempt_limit(self):
        BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )
        self.api.force_authenticate(self.owner)

        with patch(
            "apps.bots.outbound_delivery.send_message",
            side_effect=TimeoutError("provider timeout"),
        ):
            response = self.api.post(
                f"/api/inbox/conversations/{self.conversation.id}/messages/",
                {"text": "Final attempt", "sender_type": "manager"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], BotMessage.Statuses.FAILED)
        self.assertEqual(response.data["delivery_attempts"], 1)
        self.assertIsNone(response.data["delivery_next_retry_at"])

    def test_delivery_claim_is_single_winner(self):
        from apps.bots.outbound_delivery import claim_outbound_message

        message = BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.OUTBOUND,
            sender_type=BotMessage.SenderTypes.MANAGER,
            text="Claim once",
            status=BotMessage.Statuses.QUEUED,
        )

        first = claim_outbound_message(message.id)
        second = claim_outbound_message(message.id)

        self.assertIsNotNone(first)
        self.assertEqual(first.status, BotMessage.Statuses.DELIVERING)
        self.assertEqual(first.delivery_attempts, 1)
        self.assertIsNone(second)

    @override_settings(OUTBOUND_MESSAGES_RUN_INLINE=False)
    def test_outbound_delivery_dispatches_to_celery_after_commit(self):
        self.api.force_authenticate(self.owner)

        with patch("apps.bots.tasks.process_outbound_message_task.delay") as dispatch:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.api.post(
                    f"/api/inbox/conversations/{self.conversation.id}/messages/",
                    {"text": "Queue in Celery", "sender_type": "manager"},
                    format="json",
                )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], BotMessage.Statuses.QUEUED)
        dispatch.assert_called_once_with(response.data["id"])

    def test_due_outbound_retry_is_processed_and_health_contains_only_counts(self):
        from apps.bots.outbound_delivery import outbound_delivery_health, process_due_outbound_messages

        BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )
        message = BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.OUTBOUND,
            sender_type=BotMessage.SenderTypes.MANAGER,
            text="Sensitive customer message",
            status=BotMessage.Statuses.RETRY_SCHEDULED,
            delivery_next_retry_at=timezone.now() - timezone.timedelta(seconds=1),
        )

        before = outbound_delivery_health()
        with patch(
            "apps.bots.outbound_delivery.send_message",
            return_value={"ok": True, "mock": False, "provider_message_id": "provider-due-1"},
        ):
            processed = process_due_outbound_messages()
        after = outbound_delivery_health()

        message.refresh_from_db()
        self.assertEqual(before["due_retry"], 1)
        self.assertGreaterEqual(before["oldest_pending_age_seconds"], 0)
        self.assertGreaterEqual(before["oldest_due_retry_age_seconds"], 0)
        self.assertEqual([item.id for item in processed], [message.id])
        self.assertEqual(message.status, BotMessage.Statuses.SENT)
        self.assertEqual(after["due_retry"], 0)
        self.assertEqual(after["oldest_due_retry_age_seconds"], 0)
        self.assertNotIn("Sensitive customer message", str(before))
        self.assertNotIn("Sensitive customer message", str(after))

    def test_stale_delivery_lock_does_not_exceed_attempt_limit(self):
        from apps.bots.outbound_delivery import recover_stale_outbound_messages

        message = BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.OUTBOUND,
            sender_type=BotMessage.SenderTypes.MANAGER,
            text="Do not send a sixth time",
            status=BotMessage.Statuses.DELIVERING,
            delivery_attempts=5,
            delivery_max_attempts=5,
            delivery_locked_at=timezone.now() - timezone.timedelta(hours=1),
        )

        result = recover_stale_outbound_messages()

        message.refresh_from_db()
        self.assertEqual(result, {"retry_scheduled": 0, "failed": 1})
        self.assertEqual(message.status, BotMessage.Statuses.FAILED)
        self.assertIsNone(message.delivery_next_retry_at)

    def test_retry_request_idempotency_does_not_repeat_provider_or_activity(self):
        BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )
        original = BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.OUTBOUND,
            sender_type=BotMessage.SenderTypes.MANAGER,
            text="Retry exactly once",
            status=BotMessage.Statuses.FAILED,
            error_text="Provider delivery failed.",
        )
        self.api.force_authenticate(self.owner)
        headers = {"HTTP_IDEMPOTENCY_KEY": "retry-once-1"}

        with patch(
            "apps.bots.outbound_delivery.send_message",
            return_value={"ok": False, "retryable": False, "reason": "Invalid recipient."},
        ) as provider:
            first = self.api.post(
                f"/api/inbox/conversations/{self.conversation.id}/retry-message/",
                {"message_id": original.id},
                format="json",
                **headers,
            )
            replay = self.api.post(
                f"/api/inbox/conversations/{self.conversation.id}/retry-message/",
                {"message_id": original.id},
                format="json",
                **headers,
            )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(first.data["id"], original.id)
        self.assertEqual(replay.data["id"], original.id)
        self.assertEqual(provider.call_count, 1)
        self.assertEqual(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.MESSAGE_RETRIED,
                metadata__original_message_id=original.id,
            ).count(),
            1,
        )

    def test_outbound_send_enforces_permission_and_tenant_scope(self):
        support = User.objects.create_user(
            username="inbox-support",
            email="inbox-support@example.com",
            password="pass",
            role=User.Roles.STAFF,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=support,
            role=BusinessMember.Roles.SUPPORT,
        )

        self.api.force_authenticate(support)
        denied = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/messages/",
            {"text": "Not permitted", "sender_type": "manager"},
            format="json",
        )
        self.api.force_authenticate(self.owner)
        hidden_other_tenant = self.api.post(
            f"/api/inbox/conversations/{self.other_conversation.id}/messages/",
            {"text": "Cross tenant", "sender_type": "manager"},
            format="json",
        )

        self.assertEqual(denied.status_code, 403)
        self.assertIn(hidden_other_tenant.status_code, {403, 404})
        self.assertFalse(BotMessage.objects.filter(text__in=["Not permitted", "Cross tenant"]).exists())

    def test_public_website_chat_flows_into_inbox_and_manager_reply_updates_state(self):
        channel = BotChannel.objects.create(
            bot=self.bot,
            channel=BotChannel.Channels.WEBSITE,
            status=BotChannel.Statuses.ACTIVE,
        )

        public_response = self.api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Pilot Visitor",
                "phone": "+77015550999",
                "message": "Хочу консультацию с сайта",
                "external_user_id": "pilot-visitor-1",
            },
            format="json",
        )

        self.assertEqual(public_response.status_code, 201)
        conversation = BotConversation.objects.get(public_id=public_response.data["conversation_id"])
        self.assertEqual(conversation.business, self.business)
        self.assertEqual(conversation.channel, BotConversation.Channels.WEBSITE)
        self.assertEqual(conversation.unread_count, 1)
        self.assertIsNotNone(conversation.lead)
        self.assertEqual(BotMessage.objects.filter(conversation=conversation, direction=BotMessage.Directions.INBOUND).count(), 1)

        self.api.force_authenticate(self.owner)
        inbox_response = self.api.get("/api/inbox/conversations/?channel=website&unread=true&q=консультацию")
        self.assertEqual(inbox_response.status_code, 200)
        self.assertEqual(inbox_response.data["count"], 1)
        self.assertEqual(inbox_response.data["results"][0]["id"], conversation.id)

        reply_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/messages/",
            {"text": "Здравствуйте, можем записать вас сегодня.", "sender_type": "manager"},
            format="json",
        )

        self.assertEqual(reply_response.status_code, 201)
        self.assertEqual(reply_response.data["direction"], BotMessage.Directions.OUTBOUND)
        conversation.refresh_from_db()
        self.assertEqual(conversation.unread_count, 1)
        self.assertIsNotNone(conversation.last_outbound_at)

        mark_read_response = self.api.post(f"/api/inbox/conversations/{conversation.id}/mark-read/")
        self.assertEqual(mark_read_response.status_code, 200)
        self.assertEqual(mark_read_response.data["unread_count"], 0)

    def test_inbox_suggest_reply_uses_conversation_context(self):
        BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Хочу записаться на консультацию завтра",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/inbox/conversations/{self.conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["suggested_reply"])
        self.assertEqual(response.data["messages_used"], 1)
        self.assertEqual(response.data["client_id"], self.client.id)
        self.assertIsNone(response.data["lead_id"])
        log = AIRequestLog.objects.filter(prompt_type="bot_suggest_reply").latest("id")
        self.assertEqual(log.input_json["crm_context"]["client"]["id"], self.client.id)

    def test_legacy_bot_suggest_reply_endpoint_still_works(self):
        BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Нужна цена",
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/bot-conversations/{self.conversation.id}/suggest-reply/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["suggested_reply"])
        self.assertEqual(response.data["messages_used"], 1)

    def test_inbox_can_create_task_and_lead_from_conversation(self):
        BotMessage.objects.create(
            conversation=self.conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Нужна консультация",
        )
        self.api.force_authenticate(self.owner)

        lead_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-lead/",
            {"message": "Lead from inbox"},
            format="json",
        )
        self.assertEqual(lead_response.status_code, 201)
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.lead_id, lead_response.data["id"])

        task_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            {"title": "Перезвонить из inbox", "priority": "high"},
            format="json",
        )
        self.assertEqual(task_response.status_code, 201)
        self.assertEqual(task_response.data["lead"], self.conversation.lead_id)
        self.assertEqual(task_response.data["client"], self.client.id)
        self.assertEqual(task_response.data["conversation"], self.conversation.id)
        created_task = Task.objects.get(id=task_response.data["id"])
        self.assertEqual(created_task.business, self.business)
        self.assertEqual(created_task.conversation, self.conversation)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type=ActivityEvents.TASK_CREATED,
                entity_id=str(task_response.data["id"]),
                metadata__event_type=ActivityEvents.TASK_CREATED,
                metadata__conversation_id=self.conversation.id,
            ).exists()
        )

    def test_inbox_can_create_appointment_from_conversation_when_data_is_complete(self):
        lead = Lead.objects.create(business=self.business, client=self.client, source=Lead.Sources.WEBSITE, responsible_user=self.manager)
        self.conversation.lead = lead
        self.conversation.assigned_to = self.manager
        self.conversation.save(update_fields=["lead", "assigned_to", "updated_at"])
        service = Service.objects.create(business=self.business, name="Inbox consultation", duration_minutes=30, price_from=10000)
        start_at = (timezone.now() + timezone.timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        WorkingHours.objects.create(
            business=self.business,
            weekday=start_at.weekday(),
            start_time=time(9, 0),
            end_time=time(18, 0),
            is_day_off=False,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-appointment/",
            {"service_id": service.id, "start_at": start_at.isoformat(), "notes": "Booked from inbox"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["client"], self.client.id)
        self.assertEqual(response.data["lead"], lead.id)
        self.assertEqual(response.data["service"], service.id)
        self.assertEqual(response.data["source"], Appointment.Sources.WEBSITE)
        lead.refresh_from_db()
        self.assertEqual(lead.service, service)
        self.assertEqual(lead.status, Lead.Statuses.APPOINTMENT_CREATED)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                event_type=ActivityEvents.APPOINTMENT_CREATED,
                entity_type="Lead",
                entity_id=str(lead.id),
                metadata__lifecycle_action="lead_appointment_created",
                metadata__conversation_id=self.conversation.id,
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type=ActivityEvents.APPOINTMENT_CREATED,
                entity_id=str(response.data["id"]),
                metadata__event_type=ActivityEvents.APPOINTMENT_CREATED,
                metadata__conversation_id=self.conversation.id,
            ).exists()
        )
        self.assertTrue(Notification.objects.filter(business=self.business, appointment_id=response.data["id"]).exists())

        empty_conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="empty-visitor",
        )
        missing_client_response = self.api.post(
            f"/api/inbox/conversations/{empty_conversation.id}/create-appointment/",
            {"service_id": service.id, "start_at": start_at.isoformat()},
            format="json",
        )
        self.assertEqual(missing_client_response.status_code, 400)

    def test_inbox_rejects_appointment_when_linked_lead_transition_is_invalid(self):
        lead = Lead.objects.create(
            business=self.business,
            client=self.client,
            source=Lead.Sources.WEBSITE,
            responsible_user=self.manager,
            status=Lead.Statuses.CLOSED,
        )
        self.conversation.lead = lead
        self.conversation.assigned_to = self.manager
        self.conversation.save(update_fields=["lead", "assigned_to", "updated_at"])
        service = Service.objects.create(business=self.business, name="Inbox consultation", duration_minutes=30, price_from=10000)
        start_at = (timezone.now() + timezone.timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        WorkingHours.objects.create(
            business=self.business,
            weekday=start_at.weekday(),
            start_time=time(9, 0),
            end_time=time(18, 0),
            is_day_off=False,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-appointment/",
            {"service_id": service.id, "start_at": start_at.isoformat(), "notes": "Booked from inbox"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Appointment.objects.filter(business=self.business, lead=lead).exists())
        lead.refresh_from_db()
        self.assertEqual(lead.status, Lead.Statuses.CLOSED)

    def test_inbox_can_link_existing_lead_and_reject_foreign_lead(self):
        lead = Lead.objects.create(business=self.business, client=self.client, source=Lead.Sources.WEBSITE)
        foreign_client = self.other_business.clients.create(full_name="Foreign client")
        foreign_lead = Lead.objects.create(business=self.other_business, client=foreign_client)
        self.api.force_authenticate(self.owner)

        foreign_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/link-lead/",
            {"lead_id": foreign_lead.id},
            format="json",
        )
        self.assertEqual(foreign_response.status_code, 400)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/link-lead/",
            {"lead_id": lead.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["lead"], lead.id)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type=ActivityEvents.CONVERSATION_LEAD_LINKED,
                entity_id=str(lead.id),
                metadata__event_type=ActivityEvents.CONVERSATION_LEAD_LINKED,
                metadata__conversation_id=self.conversation.id,
            ).exists()
        )

    def test_inbox_create_appointment_replays_idempotency_key(self):
        lead = Lead.objects.create(
            business=self.business,
            client=self.client,
            source=Lead.Sources.WEBSITE,
            responsible_user=self.manager,
        )
        self.conversation.lead = lead
        self.conversation.assigned_to = self.manager
        self.conversation.save(update_fields=["lead", "assigned_to", "updated_at"])
        service = Service.objects.create(
            business=self.business,
            name="Inbox idempotent consultation",
            duration_minutes=30,
        )
        start_at = (timezone.now() + timezone.timedelta(days=1)).replace(
            hour=11,
            minute=0,
            second=0,
            microsecond=0,
        )
        WorkingHours.objects.create(
            business=self.business,
            weekday=start_at.weekday(),
            start_time=time(9, 0),
            end_time=time(18, 0),
            is_day_off=False,
        )
        self.api.force_authenticate(self.owner)
        payload = {
            "service_id": service.id,
            "start_at": start_at.isoformat(),
            "notes": "Book once",
        }
        headers = {"HTTP_IDEMPOTENCY_KEY": "inbox-appointment-once"}

        first = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-appointment/",
            payload,
            format="json",
            **headers,
        )
        replay = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-appointment/",
            payload,
            format="json",
            **headers,
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.data["id"], first.data["id"])
        self.assertEqual(
            Appointment.objects.filter(
                business=self.business,
                lead=lead,
                service=service,
            ).count(),
            1,
        )

    def test_inbox_can_create_and_link_client_from_conversation(self):
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="new-visitor",
        )
        duplicate = self.business.clients.create(full_name="Existing visitor", phone="+77010000000")
        self.api.force_authenticate(self.owner)

        duplicate_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/create-client/",
            {"full_name": "New visitor", "phone": "+7 701 000 00 00"},
            format="json",
        )
        self.assertEqual(duplicate_response.status_code, 200)
        self.assertTrue(duplicate_response.data["requires_confirmation"])
        self.assertEqual(duplicate_response.data["duplicates"][0]["id"], duplicate.id)

        link_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/link-client/",
            {"client_id": duplicate.id},
            format="json",
        )
        self.assertEqual(link_response.status_code, 200)
        self.assertEqual(link_response.data["client"], duplicate.id)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=duplicate,
                actor=self.owner,
                event_type=ActivityEvents.CONVERSATION_CLIENT_LINKED,
                entity_id=str(duplicate.id),
                metadata__event_type=ActivityEvents.CONVERSATION_CLIENT_LINKED,
                metadata__conversation_id=conversation.id,
            ).exists()
        )

        conversation.refresh_from_db()
        conversation.client = None
        conversation.save(update_fields=["client"])
        create_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/create-client/",
            {"full_name": "Forced visitor", "phone": "+7 701 000 00 00", "force_create": True},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertTrue(create_response.data["created"])
        self.assertEqual(create_response.data["client"]["full_name"], "Forced visitor")
        created_client_id = create_response.data["client"]["id"]
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                actor=self.owner,
                event_type=ActivityEvents.CLIENT_CREATED,
                entity_id=str(created_client_id),
                metadata__event_type=ActivityEvents.CLIENT_CREATED,
                metadata__conversation_id=conversation.id,
            ).exists()
        )

    def test_inbox_can_create_and_link_deal_from_conversation(self):
        self.api.force_authenticate(self.owner)

        create_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-deal/",
            {"title": "Inbox deal", "amount": "15000.00"},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["title"], "Inbox deal")
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.deal_id, create_response.data["id"])

        pipeline = Pipeline.objects.get(business=self.business)
        stage = PipelineStage.objects.get(pipeline=pipeline)
        other_deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=pipeline,
            stage=stage,
            title="Existing linked deal",
        )
        link_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/link-deal/",
            {"deal_id": other_deal.id},
            format="json",
        )
        self.assertEqual(link_response.status_code, 200)
        self.assertEqual(link_response.data["deal"], other_deal.id)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type=ActivityEvents.CONVERSATION_DEAL_LINKED,
                entity_id=str(other_deal.id),
                metadata__event_type=ActivityEvents.CONVERSATION_DEAL_LINKED,
                metadata__conversation_id=self.conversation.id,
            ).exists()
        )

    def test_inbox_run_pipeline_creates_idempotent_crm_chain(self):
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WHATSAPP,
            external_user_id="+77017770000",
        )
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Здравствуйте, хочу записаться и узнать цену",
            payload_json={"whatsapp_profile_name": "Pipeline Client"},
        )
        self.api.force_authenticate(self.owner)

        missing_preview_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/run-pipeline/",
            {"deal_title": "WhatsApp deal", "create_task": True},
            format="json",
        )
        self.assertEqual(missing_preview_response.status_code, 400)
        self.assertEqual(Client.objects.filter(business=self.business, whatsapp_id="+77017770000").count(), 0)

        preview_response = self.api.post(f"/api/inbox/conversations/{conversation.id}/qualify/", format="json")
        self.assertEqual(preview_response.status_code, 200)
        self.assertEqual(preview_response.data["qualification"]["intent"], "appointment_request")
        self.assertIsNotNone(preview_response.data["ai_log_id"])
        conversation.refresh_from_db()
        self.assertEqual(
            conversation.metadata_json["conversation_qualification_preview"]["qualification"]["intent"],
            "appointment_request",
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                actor=self.owner,
                event_type=ActivityEvents.CONVERSATION_QUALIFICATION_PREVIEWED,
                metadata__event_type=ActivityEvents.CONVERSATION_QUALIFICATION_PREVIEWED,
                metadata__conversation_id=conversation.id,
                metadata__ai_log_id=preview_response.data["ai_log_id"],
            ).exists()
        )

        response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/run-pipeline/",
            {"deal_title": "WhatsApp deal", "create_task": True},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], {"client": True, "lead": True, "deal": True, "task": True})
        self.assertEqual(response.data["qualification"]["intent"], "appointment_request")
        self.assertGreaterEqual(response.data["qualification"]["confidence"], 0.7)
        self.assertEqual(response.data["ai_log_id"], preview_response.data["ai_log_id"])
        conversation.refresh_from_db()
        self.assertEqual(conversation.client_id, response.data["client"]["id"])
        self.assertEqual(conversation.lead_id, response.data["lead"]["id"])
        self.assertEqual(conversation.deal_id, response.data["deal"]["id"])
        self.assertEqual(response.data["deal"]["lead"], response.data["lead"]["id"])
        self.assertEqual(response.data["task"]["deal"], response.data["deal"]["id"])
        self.assertEqual(conversation.metadata_json["conversation_pipeline"]["qualification"]["intent"], "appointment_request")
        self.assertTrue(AIRequestLog.objects.filter(prompt_type="conversation_qualification", id=response.data["ai_log_id"]).exists())
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.CLIENT_CREATED,
                entity_id=str(response.data["client"]["id"]),
                metadata__event_type=ActivityEvents.CLIENT_CREATED,
                metadata__conversation_id=conversation.id,
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.LEAD_CREATED,
                entity_id=str(response.data["lead"]["id"]),
                metadata__event_type=ActivityEvents.LEAD_CREATED,
                metadata__conversation_id=conversation.id,
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.DEAL_CREATED,
                entity_id=str(response.data["deal"]["id"]),
                metadata__event_type=ActivityEvents.DEAL_CREATED,
                metadata__conversation_id=conversation.id,
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.TASK_CREATED,
                entity_id=str(response.data["task"]["id"]),
                metadata__event_type=ActivityEvents.TASK_CREATED,
                metadata__conversation_id=conversation.id,
            ).exists()
        )

        second_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/run-pipeline/",
            {"deal_title": "WhatsApp deal", "create_task": True},
            format="json",
        )

        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(second_response.data["created"], {"client": False, "lead": False, "deal": False, "task": False})
        self.assertEqual(Client.objects.filter(business=self.business, whatsapp_id="+77017770000").count(), 1)
        self.assertEqual(Lead.objects.filter(business=self.business, client_id=response.data["client"]["id"]).count(), 1)
        self.assertEqual(Deal.objects.filter(business=self.business, client_id=response.data["client"]["id"]).count(), 1)
        self.assertEqual(Task.objects.filter(business=self.business, client_id=response.data["client"]["id"]).count(), 1)

    def test_inbox_qualification_preview_does_not_create_crm_entities_and_requires_permission(self):
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WHATSAPP,
            external_user_id="+77018880000",
        )
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="РќСѓР¶РЅР° С†РµРЅР° Рё РєРѕРЅСЃСѓР»СЊС‚Р°С†РёСЏ",
        )
        support = User.objects.create_user(
            username="inbox-support",
            email="inbox-support@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OPERATOR,
        )
        BusinessMember.objects.create(business=self.business, user=support, role=BusinessMember.Roles.SUPPORT)
        self.api.force_authenticate(support)

        denied_response = self.api.post(f"/api/inbox/conversations/{conversation.id}/qualify/", format="json")
        self.assertEqual(denied_response.status_code, 403)

        before_counts = {
            "clients": Client.objects.filter(business=self.business).count(),
            "leads": Lead.objects.filter(business=self.business).count(),
            "deals": Deal.objects.filter(business=self.business).count(),
            "tasks": Task.objects.filter(business=self.business).count(),
        }
        self.api.force_authenticate(self.owner)
        response = self.api.post(f"/api/inbox/conversations/{conversation.id}/qualify/", format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["conversation"]["id"], conversation.id)
        self.assertTrue(response.data["qualification"]["intent"])
        self.assertEqual(response.data["last_message_id"], conversation.messages.order_by("-created_at").first().id)
        self.assertEqual(Client.objects.filter(business=self.business).count(), before_counts["clients"])
        self.assertEqual(Lead.objects.filter(business=self.business).count(), before_counts["leads"])
        self.assertEqual(Deal.objects.filter(business=self.business).count(), before_counts["deals"])
        self.assertEqual(Task.objects.filter(business=self.business).count(), before_counts["tasks"])

    def test_inbox_run_pipeline_rejects_stale_ai_preview(self):
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WHATSAPP,
            external_user_id="+77019990000",
        )
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="РҐРѕС‡Сѓ СѓР·РЅР°С‚СЊ С†РµРЅСѓ",
        )
        self.api.force_authenticate(self.owner)
        preview_response = self.api.post(f"/api/inbox/conversations/{conversation.id}/qualify/", format="json")
        self.assertEqual(preview_response.status_code, 200)
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Р РµС‰Рµ РЅСѓР¶РЅР° Р·Р°РїРёСЃСЊ РЅР° Р·Р°РІС‚СЂР°",
        )

        response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/run-pipeline/",
            {"deal_title": "Stale preview deal", "create_task": True},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Client.objects.filter(business=self.business, whatsapp_id="+77019990000").count(), 0)

    def test_inbox_priority_close_reopen_and_mark_unread_actions_work(self):
        self.api.force_authenticate(self.owner)

        unread_response = self.api.post(f"/api/inbox/conversations/{self.conversation.id}/mark-unread/")
        self.assertEqual(unread_response.status_code, 200)
        self.assertEqual(unread_response.data["unread_count"], 1)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type="conversation_marked_unread",
                metadata__conversation_id=self.conversation.id,
            ).exists()
        )

        priority_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/set-priority/",
            {"priority": BotConversation.Priorities.URGENT},
            format="json",
        )
        self.assertEqual(priority_response.status_code, 200)
        self.assertEqual(priority_response.data["priority"], BotConversation.Priorities.URGENT)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type="conversation_priority_changed",
                metadata__conversation_id=self.conversation.id,
                metadata__to_priority=BotConversation.Priorities.URGENT,
            ).exists()
        )

        close_response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/close/",
            {"reason": "Resolved"},
            format="json",
        )
        self.assertEqual(close_response.status_code, 200)
        self.assertEqual(close_response.data["status"], BotConversation.Statuses.CLOSED)
        self.assertFalse(close_response.data["handoff_required"])
        self.assertFalse(close_response.data["bot_enabled"])
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type="conversation_closed",
                metadata__conversation_id=self.conversation.id,
                metadata__reason="Resolved",
            ).exists()
        )

        reopen_response = self.api.post(f"/api/inbox/conversations/{self.conversation.id}/reopen/")
        self.assertEqual(reopen_response.status_code, 200)
        self.assertEqual(reopen_response.data["status"], BotConversation.Statuses.OPEN)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=self.client,
                actor=self.owner,
                event_type="conversation_reopened",
                metadata__conversation_id=self.conversation.id,
            ).exists()
        )

    def test_inbox_rejects_invalid_priority(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/set-priority/",
            {"priority": "critical"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
