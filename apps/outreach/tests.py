from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.activities.services import create_activity_event
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.notifications.models import Notification
from apps.outreach.consent import payload_has_explicit_consent, record_inbound_consent
from apps.outreach.models import OutreachCampaign, OutreachConsent, OutreachRecipient, OutreachTemplate
from apps.outreach.services import appointment_automation_status, campaign_launch_checklist, campaign_stats, render_message, retry_failed_recipients
from apps.scheduling.services import APPOINTMENT_CONFIRMATION_LABEL, APPOINTMENT_REMINDER_LABEL, APPOINTMENT_THANK_YOU_LABEL
from apps.integrations.providers.whatsapp import WhatsAppProvider


class OutreachCampaignTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="outreach-owner", email="outreach-owner@example.com", password="pass", role=User.Roles.BUSINESS_OWNER)
        self.marketer = User.objects.create_user(username="outreach-marketer", email="outreach-marketer@example.com", password="pass", role=User.Roles.BUSINESS_OWNER)
        self.manager = User.objects.create_user(username="outreach-manager", email="outreach-manager@example.com", password="pass", role=User.Roles.BUSINESS_OWNER)
        self.operator = User.objects.create_user(username="outreach-operator", email="outreach-operator@example.com", password="pass", role=User.Roles.BUSINESS_OPERATOR)
        self.accountant = User.objects.create_user(username="outreach-accountant", email="outreach-accountant@example.com", password="pass", role=User.Roles.BUSINESS_MANAGER)
        self.business = Business.objects.create(owner=self.owner, name="Outreach Biz", slug="outreach-biz")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.marketer, role=BusinessMember.Roles.MARKETER)
        BusinessMember.objects.create(business=self.business, user=self.manager, role=BusinessMember.Roles.MANAGER)
        BusinessMember.objects.create(business=self.business, user=self.operator, role=BusinessMember.Roles.OPERATOR)
        BusinessMember.objects.create(business=self.business, user=self.accountant, role=BusinessMember.Roles.ACCOUNTANT)
        self.telegram_client = Client.objects.create(business=self.business, full_name="Telegram Client", telegram_id="1001")
        self.whatsapp_client = Client.objects.create(business=self.business, full_name="WhatsApp Client", phone="+77010001010")
        OutreachConsent.objects.create(
            business=self.business,
            client=self.telegram_client,
            channel=OutreachConsent.Channels.TELEGRAM,
            status=OutreachConsent.Statuses.OPTED_IN,
            source="test",
        )
        self.client.force_authenticate(self.owner)

    def test_prepare_and_launch_telegram_campaign_creates_due_notifications(self):
        campaign = OutreachCampaign.objects.create(
            business=self.business,
            name="Telegram recall",
            channel=OutreachCampaign.Channels.TELEGRAM,
            audience_type=OutreachCampaign.AudienceTypes.ALL_CLIENTS,
            message_text="Здравствуйте, {client_name}!",
        )

    def test_campaign_template_variables_are_validated_and_rendered(self):
        template = OutreachTemplate.objects.create(
            business=self.business,
            name="Recall",
            channel=OutreachTemplate.Channels.TELEGRAM,
            body="Здравствуйте, {client_name}! Это {business_name}.",
            is_approved=True,
        )

        response = self.client.post(
            "/api/outreach/campaigns/",
            {
                "business": self.business.id,
                "name": "Template campaign",
                "channel": OutreachCampaign.Channels.TELEGRAM,
                "template": template.id,
                "message_text": template.body,
            },
            format="json",
        )
        bad_response = self.client.post(
            "/api/outreach/templates/",
            {
                "business": self.business.id,
                "name": "Bad template",
                "channel": OutreachTemplate.Channels.TELEGRAM,
                "body": "Hello {unknown_var}",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(bad_response.status_code, 400)
        self.assertIn("Outreach Biz", render_message(template.body, self.telegram_client))

    def test_launch_checklist_blocks_unprepared_campaign(self):
        campaign = OutreachCampaign.objects.create(
            business=self.business,
            name="Checklist",
            channel=OutreachCampaign.Channels.TELEGRAM,
            audience_type=OutreachCampaign.AudienceTypes.ALL_CLIENTS,
            message_text="Здравствуйте, {client_name}!",
        )

        checklist = campaign_launch_checklist(campaign)
        response = self.client.get(f"/api/outreach/campaigns/{campaign.id}/launch-checklist/")

        self.assertFalse(checklist["can_launch"])
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["can_launch"])
        self.assertTrue(any(item["key"] == "prepared" and not item["ok"] for item in response.data["checks"]))
        prepare_response = self.client.post(f"/api/outreach/campaigns/{campaign.id}/prepare/")
        launch_response = self.client.post(f"/api/outreach/campaigns/{campaign.id}/launch/")

        campaign.refresh_from_db()
        self.assertEqual(prepare_response.status_code, 200)
        self.assertEqual(prepare_response.data["total"], 1)
        self.assertEqual(launch_response.status_code, 200)
        self.assertEqual(campaign.status, OutreachCampaign.Statuses.RUNNING)
        recipient = OutreachRecipient.objects.get(campaign=campaign)
        self.assertEqual(recipient.client, self.telegram_client)
        self.assertEqual(recipient.status, OutreachRecipient.Statuses.PENDING)
        notification = Notification.objects.get(id=recipient.notification_id)
        self.assertEqual(notification.channel, Notification.Channels.TELEGRAM)
        self.assertEqual(notification.category, Notification.Categories.OUTREACH)
        self.assertLessEqual(notification.send_at, timezone.now())
        self.assertIn("Telegram Client", notification.text)
        self.assertTrue(
            Notification.objects.filter(
                business=self.business,
                channel=Notification.Channels.SYSTEM,
                category=Notification.Categories.OUTREACH,
                text__contains="запущена",
            ).exists()
        )

    def test_appointment_automation_status_reports_followup_queues(self):
        for label, status in [
            (APPOINTMENT_CONFIRMATION_LABEL, Notification.Statuses.PENDING),
            (APPOINTMENT_REMINDER_LABEL, Notification.Statuses.SENT),
            (APPOINTMENT_THANK_YOU_LABEL, Notification.Statuses.FAILED),
        ]:
            Notification.objects.create(
                business=self.business,
                client=self.telegram_client,
                channel=Notification.Channels.TELEGRAM,
                category=Notification.Categories.SALES,
                priority=Notification.Priorities.NORMAL,
                text=label,
                action_label=label,
                send_at=timezone.now(),
                status=status,
            )

        status = appointment_automation_status(self.business)
        response = self.client.get(f"/api/outreach/campaigns/appointment-automation-status/?business={self.business.id}")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(status["enabled"])
        self.assertEqual(response.data["total_pending"], 1)
        self.assertEqual(response.data["total_failed"], 1)
        self.assertEqual(len(response.data["scenarios"]), 3)
        self.assertEqual(len(response.data["failed_notifications"]), 1)
        self.assertEqual(response.data["failed_notifications"][0]["label"], APPOINTMENT_THANK_YOU_LABEL)
        self.assertTrue(all(item["enabled"] for item in response.data["scenarios"]))

    def test_prepare_skips_clients_without_opt_in(self):
        campaign = OutreachCampaign.objects.create(
            business=self.business,
            name="WhatsApp recall",
            channel=OutreachCampaign.Channels.WHATSAPP,
            audience_type=OutreachCampaign.AudienceTypes.ALL_CLIENTS,
            message_text="Здравствуйте, {client_name}!",
        )

        response = self.client.post(f"/api/outreach/campaigns/{campaign.id}/prepare/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["skipped"], 1)
        recipient = OutreachRecipient.objects.get(campaign=campaign, client=self.whatsapp_client)
        self.assertEqual(recipient.status, OutreachRecipient.Statuses.SKIPPED)
        self.assertIn("opt-in", recipient.skipped_reason)

    def test_prepare_manual_campaign_uses_selected_clients_only(self):
        selected_client = Client.objects.create(business=self.business, full_name="Selected Telegram Client", telegram_id="2001")
        OutreachConsent.objects.create(
            business=self.business,
            client=selected_client,
            channel=OutreachConsent.Channels.TELEGRAM,
            status=OutreachConsent.Statuses.OPTED_IN,
            source="test",
        )
        campaign = OutreachCampaign.objects.create(
            business=self.business,
            name="Manual Telegram",
            channel=OutreachCampaign.Channels.TELEGRAM,
            audience_type=OutreachCampaign.AudienceTypes.MANUAL,
            message_text="Здравствуйте, {client_name}!",
        )

        response = self.client.post(f"/api/outreach/campaigns/{campaign.id}/prepare/", {"client_ids": [selected_client.id]}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 1)
        self.assertTrue(OutreachRecipient.objects.filter(campaign=campaign, client=selected_client).exists())
        self.assertFalse(OutreachRecipient.objects.filter(campaign=campaign, client=self.telegram_client).exists())

    def test_whatsapp_launch_requires_approved_template(self):
        OutreachConsent.objects.create(
            business=self.business,
            client=self.whatsapp_client,
            channel=OutreachConsent.Channels.WHATSAPP,
            status=OutreachConsent.Statuses.OPTED_IN,
            source="test",
        )
        campaign = OutreachCampaign.objects.create(
            business=self.business,
            name="WhatsApp recall",
            channel=OutreachCampaign.Channels.WHATSAPP,
            audience_type=OutreachCampaign.AudienceTypes.ALL_CLIENTS,
            message_text="Здравствуйте, {client_name}!",
            whatsapp_template_status=OutreachCampaign.TemplateStatuses.DRAFT,
        )
        self.client.post(f"/api/outreach/campaigns/{campaign.id}/prepare/")

        response = self.client.post(f"/api/outreach/campaigns/{campaign.id}/launch/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("approved template", str(response.data))
        self.assertTrue(
            Notification.objects.filter(
                business=self.business,
                recipient=self.owner,
                category=Notification.Categories.AI_ALERTS,
                action_label="Подключить услугу",
            ).exists()
        )

    def test_marketer_can_create_prepare_and_launch_campaign(self):
        self.client.force_authenticate(self.marketer)

        template_response = self.client.post(
            "/api/outreach/templates/",
            {
                "business": self.business.id,
                "name": "Marketer template",
                "channel": OutreachTemplate.Channels.TELEGRAM,
                "body": "Здравствуйте, {client_name}!",
            },
            format="json",
        )
        create_response = self.client.post(
            "/api/outreach/campaigns/",
            {
                "business": self.business.id,
                "name": "Marketer launch",
                "channel": OutreachCampaign.Channels.TELEGRAM,
                "audience_type": OutreachCampaign.AudienceTypes.ALL_CLIENTS,
                "message_text": "Здравствуйте, {client_name}!",
            },
            format="json",
        )
        campaign_id = create_response.data["id"]
        prepare_response = self.client.post(f"/api/outreach/campaigns/{campaign_id}/prepare/")
        launch_response = self.client.post(f"/api/outreach/campaigns/{campaign_id}/launch/")

        self.assertEqual(template_response.status_code, 201)
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(prepare_response.status_code, 200)
        self.assertEqual(launch_response.status_code, 200)

    def test_non_outreach_roles_cannot_mutate_campaigns_templates_or_consents(self):
        campaign = OutreachCampaign.objects.create(
            business=self.business,
            created_by=self.owner,
            name="Manager blocked",
            channel=OutreachCampaign.Channels.TELEGRAM,
            audience_type=OutreachCampaign.AudienceTypes.ALL_CLIENTS,
            message_text="Здравствуйте, {client_name}!",
            status=OutreachCampaign.Statuses.READY,
        )
        template = OutreachTemplate.objects.create(
            business=self.business,
            created_by=self.owner,
            name="Owner template",
            channel=OutreachTemplate.Channels.TELEGRAM,
            body="Здравствуйте, {client_name}!",
        )
        consent = OutreachConsent.objects.get(business=self.business, client=self.telegram_client, channel=OutreachConsent.Channels.TELEGRAM)

        for user in [self.manager, self.operator, self.accountant]:
            self.client.force_authenticate(user)
            create_campaign_response = self.client.post(
                "/api/outreach/campaigns/",
                {
                    "business": self.business.id,
                    "name": "Blocked create",
                    "channel": OutreachCampaign.Channels.TELEGRAM,
                    "message_text": "Здравствуйте, {client_name}!",
                },
                format="json",
            )
            update_campaign_response = self.client.patch(f"/api/outreach/campaigns/{campaign.id}/", {"name": "Changed"}, format="json")
            launch_response = self.client.post(f"/api/outreach/campaigns/{campaign.id}/launch/")
            create_template_response = self.client.post(
                "/api/outreach/templates/",
                {
                    "business": self.business.id,
                    "name": "Blocked template",
                    "channel": OutreachTemplate.Channels.TELEGRAM,
                    "body": "Здравствуйте, {client_name}!",
                },
                format="json",
            )
            update_template_response = self.client.patch(f"/api/outreach/templates/{template.id}/", {"name": "Changed"}, format="json")
            update_consent_response = self.client.patch(f"/api/outreach/consents/{consent.id}/", {"status": OutreachConsent.Statuses.OPTED_OUT}, format="json")
            import_response = self.client.post(
                "/api/outreach/consents/bulk-import/",
                {
                    "business": self.business.id,
                    "channel": OutreachConsent.Channels.WHATSAPP,
                    "status": OutreachConsent.Statuses.OPTED_IN,
                    "rows": [{"phone": "+77010001010"}],
                },
                format="json",
            )

            self.assertIn(create_campaign_response.status_code, {403, 404})
            self.assertIn(update_campaign_response.status_code, {403, 404})
            self.assertIn(launch_response.status_code, {403, 404})
            self.assertIn(create_template_response.status_code, {403, 404})
            self.assertIn(update_template_response.status_code, {403, 404})
            self.assertIn(update_consent_response.status_code, {403, 404})
            self.assertIn(import_response.status_code, {403, 404})

    def test_inbound_stop_marks_client_opted_out(self):
        result = record_inbound_consent(
            business=self.business,
            channel=OutreachConsent.Channels.TELEGRAM,
            external_user_id="1001",
            text="Стоп",
        )

        consent = OutreachConsent.objects.get(business=self.business, client=self.telegram_client, channel=OutreachConsent.Channels.TELEGRAM)
        self.assertEqual(result["status"], "opted_out")
        self.assertEqual(consent.status, OutreachConsent.Statuses.OPTED_OUT)
        self.assertIsNotNone(consent.opted_out_at)
        self.assertTrue(Notification.objects.filter(business=self.business, category=Notification.Categories.OUTREACH, text__contains="отписался").exists())

    def test_retry_failed_recipients_returns_errors_to_queue(self):
        campaign = OutreachCampaign.objects.create(
            business=self.business,
            name="Retry campaign",
            channel=OutreachCampaign.Channels.TELEGRAM,
            audience_type=OutreachCampaign.AudienceTypes.ALL_CLIENTS,
            message_text="Здравствуйте, {client_name}!",
            status=OutreachCampaign.Statuses.SENT,
            finished_at=timezone.now(),
        )
        notification = Notification.objects.create(
            business=self.business,
            client=self.telegram_client,
            channel=Notification.Channels.TELEGRAM,
            category=Notification.Categories.OUTREACH,
            priority=Notification.Priorities.NORMAL,
            text="failed",
            send_at=timezone.now(),
            status=Notification.Statuses.FAILED,
        )
        recipient = OutreachRecipient.objects.create(
            business=self.business,
            campaign=campaign,
            client=self.telegram_client,
            notification=notification,
            recipient_id="1001",
            status=OutreachRecipient.Statuses.FAILED,
            error="failed",
        )

        result = retry_failed_recipients(campaign)

        campaign.refresh_from_db()
        recipient.refresh_from_db()
        self.assertEqual(result["queued"], 1)
        self.assertEqual(campaign.status, OutreachCampaign.Statuses.READY)
        self.assertIsNone(campaign.finished_at)
        self.assertEqual(recipient.status, OutreachRecipient.Statuses.QUEUED)
        self.assertIsNone(recipient.notification)
        self.assertEqual(recipient.error, "")
        self.assertEqual(recipient.error_code, "")

    def test_retry_failed_can_queue_only_retryable_errors_with_delay(self):
        campaign = OutreachCampaign.objects.create(
            business=self.business,
            name="Retry window",
            channel=OutreachCampaign.Channels.TELEGRAM,
            audience_type=OutreachCampaign.AudienceTypes.ALL_CLIENTS,
            message_text="Здравствуйте, {client_name}!",
            status=OutreachCampaign.Statuses.SENT,
            finished_at=timezone.now(),
        )
        retryable = OutreachRecipient.objects.create(
            business=self.business,
            campaign=campaign,
            client=self.telegram_client,
            recipient_id="1001",
            status=OutreachRecipient.Statuses.FAILED,
            error_code="provider_error",
            error="temporary provider error",
        )
        skipped_client = Client.objects.create(business=self.business, full_name="No consent", telegram_id="1002")
        non_retryable = OutreachRecipient.objects.create(
            business=self.business,
            campaign=campaign,
            client=skipped_client,
            recipient_id="1002",
            status=OutreachRecipient.Statuses.FAILED,
            error_code="opted_out",
            error="Client opted out",
        )

        result = retry_failed_recipients(campaign, retryable_only=True, delay_minutes=15)

        campaign.refresh_from_db()
        retryable.refresh_from_db()
        non_retryable.refresh_from_db()
        self.assertEqual(result["queued"], 1)
        self.assertEqual(result["skipped_non_retryable"], 1)
        self.assertEqual(retryable.status, OutreachRecipient.Statuses.QUEUED)
        self.assertEqual(non_retryable.status, OutreachRecipient.Statuses.FAILED)
        self.assertIsNotNone(campaign.scheduled_at)

    def test_outreach_recipient_response_masks_error_and_provider_result(self):
        campaign = OutreachCampaign.objects.create(
            business=self.business,
            name="Masked errors",
            channel=OutreachCampaign.Channels.TELEGRAM,
            audience_type=OutreachCampaign.AudienceTypes.ALL_CLIENTS,
            message_text="Здравствуйте, {client_name}!",
        )
        OutreachRecipient.objects.create(
            business=self.business,
            campaign=campaign,
            client=self.telegram_client,
            recipient_id="1001",
            status=OutreachRecipient.Statuses.FAILED,
            error="Provider failed with access_token=raw-recipient-token",
            provider_result={"reason": "Authorization: Bearer raw-provider-token"},
        )

        response = self.client.get("/api/outreach/recipients/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("raw-recipient-token", str(response.data))
        self.assertNotIn("raw-provider-token", str(response.data))

    def test_payload_explicit_consent_detects_common_fields(self):
        self.assertTrue(payload_has_explicit_consent({"whatsapp_consent": "on"}, channel=OutreachCampaign.Channels.WHATSAPP))
        self.assertTrue(payload_has_explicit_consent({"marketing_consent": True}))
        self.assertFalse(payload_has_explicit_consent({"telegram_consent": "no"}, channel=OutreachCampaign.Channels.TELEGRAM))

    def test_refresh_status_classifies_provider_errors_and_stats(self):
        campaign = OutreachCampaign.objects.create(
            business=self.business,
            name="Failed campaign",
            channel=OutreachCampaign.Channels.TELEGRAM,
            audience_type=OutreachCampaign.AudienceTypes.ALL_CLIENTS,
            message_text="Здравствуйте, {client_name}!",
            status=OutreachCampaign.Statuses.RUNNING,
        )
        notification = Notification.objects.create(
            business=self.business,
            client=self.telegram_client,
            channel=Notification.Channels.TELEGRAM,
            category=Notification.Categories.OUTREACH,
            priority=Notification.Priorities.NORMAL,
            text="failed",
            send_at=timezone.now(),
            status=Notification.Statuses.FAILED,
        )
        recipient = OutreachRecipient.objects.create(
            business=self.business,
            campaign=campaign,
            client=self.telegram_client,
            notification=notification,
            recipient_id="1001",
            status=OutreachRecipient.Statuses.PENDING,
        )
        create_activity_event(
            business=self.business,
            instance=notification,
            event_type="notification_failed",
            category="notification",
            source=Notification.Channels.TELEGRAM,
            metadata={"notification_id": notification.id, "result": {"reason": "telegram channel is not connected."}},
        )

        response = self.client.post(f"/api/outreach/campaigns/{campaign.id}/refresh-status/")

        recipient.refresh_from_db()
        stats = campaign_stats(campaign)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(recipient.status, OutreachRecipient.Statuses.FAILED)
        self.assertEqual(recipient.error_code, "channel_not_connected")
        self.assertEqual(stats["failed"], 1)
        self.assertEqual(stats["errors"][0]["code"], "channel_not_connected")

    def test_bulk_import_consents_updates_existing_clients_only(self):
        response = self.client.post(
            "/api/outreach/consents/bulk-import/",
            {
                "business": self.business.id,
                "channel": OutreachConsent.Channels.WHATSAPP,
                "status": OutreachConsent.Statuses.OPTED_IN,
                "source": "legacy_sheet",
                "rows": [
                    {"phone": "+77010001010", "note": "old form"},
                    {"phone": "+77019999999", "note": "missing"},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["imported"], 1)
        self.assertEqual(len(response.data["skipped"]), 1)
        consent = OutreachConsent.objects.get(business=self.business, client=self.whatsapp_client, channel=OutreachConsent.Channels.WHATSAPP)
        self.assertEqual(consent.status, OutreachConsent.Statuses.OPTED_IN)
        self.assertEqual(consent.source, "legacy_sheet")
        self.assertEqual(consent.evidence_json["import_row"]["note"], "old form")

    def test_bulk_import_consents_accepts_csv_file(self):
        upload = SimpleUploadedFile(
            "consents.csv",
            "phone,note\n+77010001010,old csv form\n".encode("utf-8"),
            content_type="text/csv",
        )

        response = self.client.post(
            "/api/outreach/consents/bulk-import-file/",
            {
                "business": self.business.id,
                "channel": OutreachConsent.Channels.WHATSAPP,
                "status": OutreachConsent.Statuses.OPTED_IN,
                "source": "csv_import",
                "file": upload,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["imported"], 1)
        self.assertEqual(response.data["total_rows"], 1)
        consent = OutreachConsent.objects.get(business=self.business, client=self.whatsapp_client, channel=OutreachConsent.Channels.WHATSAPP)
        self.assertEqual(consent.source, "csv_import")
        self.assertEqual(consent.evidence_json["filename"], "consents.csv")

    def test_other_business_cannot_access_outreach_campaign_or_import_consents(self):
        other_owner = User.objects.create_user(username="other-outreach-owner", email="other-outreach@example.com", password="pass", role=User.Roles.BUSINESS_OWNER)
        other_business = Business.objects.create(owner=other_owner, name="Other Outreach Biz", slug="other-outreach-biz")
        BusinessMember.objects.create(business=other_business, user=other_owner, role=BusinessMember.Roles.OWNER)
        campaign = OutreachCampaign.objects.create(
            business=other_business,
            name="Other campaign",
            channel=OutreachCampaign.Channels.TELEGRAM,
            audience_type=OutreachCampaign.AudienceTypes.ALL_CLIENTS,
            message_text="Hello",
        )

        detail_response = self.client.get(f"/api/outreach/campaigns/{campaign.id}/")
        stats_response = self.client.get(f"/api/outreach/campaigns/{campaign.id}/stats/")
        import_response = self.client.post(
            "/api/outreach/consents/bulk-import/",
            {
                "business": other_business.id,
                "channel": OutreachConsent.Channels.WHATSAPP,
                "status": OutreachConsent.Statuses.OPTED_IN,
                "rows": [{"phone": "+77010001010"}],
            },
            format="json",
        )

        self.assertEqual(detail_response.status_code, 404)
        self.assertEqual(stats_response.status_code, 404)
        self.assertEqual(import_response.status_code, 400)
        self.assertFalse(OutreachConsent.objects.filter(business=other_business).exists())

    def test_whatsapp_provider_builds_template_payload_for_outreach(self):
        payload = WhatsAppProvider()._meta_cloud_message_payload(
            "+77010001010",
            "Fallback text",
            payload={
                "whatsapp_template_name": "appointment_recall_ru",
                "whatsapp_template_language": "ru",
                "template_parameters": ["Айгерим"],
            },
        )

        self.assertEqual(payload["type"], "template")
        self.assertEqual(payload["template"]["name"], "appointment_recall_ru")
        self.assertEqual(payload["template"]["language"]["code"], "ru")
        self.assertEqual(payload["template"]["components"][0]["parameters"][0]["text"], "Айгерим")
