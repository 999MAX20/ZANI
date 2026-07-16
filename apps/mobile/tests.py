import json
from datetime import timedelta
from pathlib import Path

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.ai_core.models import ApprovalRequest
from apps.businesses.models import Business, BusinessMember
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.clients.models import Client
from apps.integrations.connectors import decrypt_credential_value, encrypt_credential_value
from apps.integrations.models import BusinessEvent
from apps.leads.models import Lead
from apps.mobile.models import MobileDevice, MobileIdempotencyKey, MobilePushToken, MobileSession, hash_mobile_secret
from apps.mobile.push import build_mobile_push_messages, deliver_mobile_push_notification
from apps.notifications.models import Notification, NotificationPreference
from apps.scheduling.models import Appointment, WorkingHours
from apps.services.models import Service
from apps.tasks.models import Task


class MobileApiFoundationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="mobile-owner",
            email="mobile-owner@example.com",
            password="StrongPass123",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="other-mobile-owner",
            email="other-mobile-owner@example.com",
            password="StrongPass123",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Mobile Clinic", slug="mobile-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Mobile Clinic", slug="other-mobile-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)

    def tearDown(self):
        cache.clear()

    def login_payload(self, **overrides):
        payload = {
            "email": self.owner.email,
            "password": "StrongPass123",
            "business": self.business.id,
            "device_id": "ios-device-1",
            "platform": "ios",
            "app_version": "1.0.0",
            "build_number": "100",
            "os_version": "18.0",
            "device_model": "iPhone",
        }
        payload.update(overrides)
        return payload

    def mobile_login(self):
        response = self.api.post("/api/mobile/v1/auth/login/", self.login_payload(), format="json")
        self.assertEqual(response.status_code, 200)
        return response

    def test_mobile_login_creates_device_session_and_tokens_without_raw_device_id(self):
        response = self.mobile_login()

        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["business"]["id"], self.business.id)
        self.assertEqual(response.data["device"]["platform"], "ios")
        self.assertNotIn("device_id", response.data["device"])
        self.assertEqual(MobileDevice.objects.count(), 1)
        self.assertEqual(self.owner.mobile_sessions.count(), 1)

    def test_mobile_refresh_rotates_session_refresh_jti(self):
        login_response = self.mobile_login()
        session = self.owner.mobile_sessions.get()
        old_jti = session.refresh_jti

        refresh_response = self.api.post(
            "/api/mobile/v1/auth/refresh/",
            {"refresh": login_response.data["refresh"]},
            format="json",
        )

        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("access", refresh_response.data)
        self.assertIn("refresh", refresh_response.data)
        session.refresh_from_db()
        self.assertNotEqual(session.refresh_jti, old_jti)

    def test_mobile_bootstrap_is_tenant_scoped(self):
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.api.get("/api/mobile/v1/bootstrap/")
        foreign_response = self.api.get(f"/api/mobile/v1/bootstrap/?business={self.other_business.id}")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["X-Request-ID"])
        self.assertEqual(response.data["active_business"]["id"], self.business.id)
        self.assertEqual([item["id"] for item in response.data["businesses"]], [self.business.id])
        self.assertEqual(foreign_response.status_code, 400)

    def test_mobile_request_id_is_echoed(self):
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.api.get("/api/mobile/v1/bootstrap/", HTTP_X_REQUEST_ID="mobile-test-request")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["X-Request-ID"], "mobile-test-request")

    def test_mobile_v1_read_contract_top_level_keys_are_stable(self):
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        contracts_path = Path(__file__).resolve().parent / "contracts" / "mobile_v1_read_contracts.json"
        contracts = json.loads(contracts_path.read_text())

        for path, expected_keys in contracts.items():
            request_path = path.replace("{business}", f"?business={self.business.id}")
            with self.subTest(path=path):
                response = self.api.get(request_path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(sorted(response.data.keys()), expected_keys)

    @override_settings(
        MOBILE_API_VERSION="mobile-v2",
        MOBILE_APP_MIN_SUPPORTED_VERSION="1.4.0",
        MOBILE_APP_LATEST_VERSION="1.6.0",
        MOBILE_APP_UPDATE_URL_IOS="https://apps.apple.com/app/zani",
        MOBILE_APP_UPDATE_URL_ANDROID="https://play.google.com/store/apps/details?id=kz.zani.app",
    )
    def test_mobile_bootstrap_exposes_version_policy(self):
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.api.get("/api/mobile/v1/bootstrap/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["api_version"], "mobile-v2")
        self.assertEqual(response.data["version_policy"]["min_supported_version"], "1.4.0")
        self.assertEqual(response.data["version_policy"]["latest_version"], "1.6.0")
        self.assertEqual(response.data["version_policy"]["update_urls"]["ios"], "https://apps.apple.com/app/zani")
        self.assertEqual(
            response.data["version_policy"]["update_urls"]["android"],
            "https://play.google.com/store/apps/details?id=kz.zani.app",
        )

    def test_mobile_device_register_rejects_foreign_business(self):
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.api.post(
            "/api/mobile/v1/devices/register/",
            {
                "business": self.other_business.id,
                "device_id": "ios-device-foreign",
                "platform": "ios",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_mobile_operations_summary_is_scoped_and_exposes_observability(self):
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        self.api.get(f"/api/mobile/v1/home/?business={self.business.id}&limit=1")

        response = self.api.get(f"/api/mobile/v1/operations/summary/?business={self.business.id}")
        foreign_response = self.api.get(f"/api/mobile/v1/operations/summary/?business={self.other_business.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["business"], self.business.id)
        self.assertGreaterEqual(response.data["devices"]["total"], 1)
        self.assertGreaterEqual(response.data["sessions"]["active"], 1)
        self.assertIn("telemetry", response.data)
        self.assertIn("by_kind", response.data["telemetry"])
        self.assertNotIn("encrypted_token", str(response.data))
        self.assertEqual(foreign_response.status_code, 400)

    def test_mobile_push_registration_hashes_token_and_hides_raw_value(self):
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.api.post(
            "/api/mobile/v1/push-tokens/register/",
            {
                "business": self.business.id,
                "device_id": "ios-device-1",
                "provider": "expo",
                "push_token": "ExponentPushToken[secret-value]",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["provider"], "expo")
        self.assertNotIn("push_token", response.data)
        self.assertNotIn("token_hash", response.data)
        self.assertNotIn("encrypted_token", response.data)
        self.assertEqual(MobilePushToken.objects.count(), 1)
        push_token = MobilePushToken.objects.get()
        self.assertNotEqual(push_token.token_hash, "ExponentPushToken[secret-value]")
        self.assertNotEqual(push_token.encrypted_token, "ExponentPushToken[secret-value]")
        self.assertEqual(decrypt_credential_value(push_token.encrypted_token), "ExponentPushToken[secret-value]")

    def test_mobile_home_returns_compact_tenant_scoped_operational_payload(self):
        client = Client.objects.create(business=self.business, full_name="Mobile Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=45, price_from=12000)
        lead = Lead.objects.create(business=self.business, client=client, source=Lead.Sources.WEBSITE, status=Lead.Statuses.NEW)
        Task.objects.create(
            business=self.business,
            client=client,
            lead=lead,
            title="Call mobile client",
            due_at=timezone.now() - timedelta(hours=1),
        )
        Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=timezone.now() + timedelta(hours=2),
            end_at=timezone.now() + timedelta(hours=3),
            status=Appointment.Statuses.CREATED,
        )
        BusinessEvent.objects.create(
            business=self.business,
            event_type="sale.recorded",
            source="manual",
            payload_json={"amount": "25000"},
        )
        other_client = Client.objects.create(business=self.other_business, full_name="Hidden Client")
        Lead.objects.create(business=self.other_business, client=other_client, source=Lead.Sources.WEBSITE, status=Lead.Statuses.NEW)
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.api.get(f"/api/mobile/v1/home/?business={self.business.id}&limit=3")
        foreign_response = self.api.get(f"/api/mobile/v1/home/?business={self.other_business.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["business"], self.business.id)
        self.assertEqual(response.data["sections"]["leads"]["new"], 1)
        self.assertEqual(response.data["sections"]["tasks"]["overdue"], 1)
        self.assertEqual(response.data["sections"]["appointments"]["needs_confirmation"], 1)
        self.assertEqual(response.data["sections"]["revenue"]["total_estimate"], "25000")
        self.assertEqual(response.data["sections"]["leads"]["latest"][0]["title"], "Mobile Client")
        self.assertNotIn("Hidden Client", str(response.data))
        self.assertGreaterEqual(response.data["attention"]["total"], 1)
        self.assertTrue(response.data["quick_actions"])
        self.assertEqual(foreign_response.status_code, 400)

    def test_mobile_home_omits_sections_without_backend_permission(self):
        accountant = User.objects.create_user(
            username="mobile-accountant",
            email="mobile-accountant@example.com",
            password="StrongPass123",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=accountant, role=BusinessMember.Roles.ACCOUNTANT)
        Client.objects.create(business=self.business, full_name="Accounting Visible Client")
        self.api.force_authenticate(accountant)

        response = self.api.get(f"/api/mobile/v1/home/?business={self.business.id}")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("leads", response.data["sections"])
        self.assertNotIn("tasks", response.data["sections"])
        self.assertNotIn("appointments", response.data["sections"])
        self.assertIn("revenue", response.data["sections"])

    def test_mobile_today_actions_and_inbox_return_compact_scoped_payloads(self):
        client = Client.objects.create(business=self.business, full_name="Today Client")
        service = Service.objects.create(business=self.business, name="Mobile Service", duration_minutes=30, price_from=9000)
        lead = Lead.objects.create(business=self.business, client=client, source=Lead.Sources.WEBSITE, status=Lead.Statuses.NEW)
        Task.objects.create(
            business=self.business,
            client=client,
            lead=lead,
            title="Today task",
            due_at=timezone.now() + timedelta(hours=1),
        )
        Task.objects.create(
            business=self.business,
            client=client,
            lead=lead,
            title="Overdue task",
            due_at=timezone.now() - timedelta(days=1, hours=2),
        )
        Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=timezone.now() + timedelta(hours=3),
            end_at=timezone.now() + timedelta(hours=4),
            status=Appointment.Statuses.CREATED,
        )
        bot = Bot.objects.create(business=self.business, name="Mobile Bot", status=Bot.Statuses.ACTIVE)
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            client=client,
            lead=lead,
            unread_count=2,
            handoff_required=True,
            last_inbound_at=timezone.now() - timedelta(minutes=10),
            last_message_at=timezone.now() - timedelta(minutes=5),
        )
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Need appointment details",
        )
        other_client = Client.objects.create(business=self.other_business, full_name="Foreign Inbox Client")
        other_bot = Bot.objects.create(business=self.other_business, name="Other Bot", status=Bot.Statuses.ACTIVE)
        BotConversation.objects.create(
            business=self.other_business,
            bot=other_bot,
            channel=BotConversation.Channels.WEBSITE,
            client=other_client,
            unread_count=9,
            last_message_at=timezone.now(),
        )
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        today_response = self.api.get(f"/api/mobile/v1/today/?business={self.business.id}&limit=5")
        actions_response = self.api.get(f"/api/mobile/v1/actions/?business={self.business.id}&limit=5")
        inbox_response = self.api.get(f"/api/mobile/v1/inbox/?business={self.business.id}&limit=5")
        foreign_response = self.api.get(f"/api/mobile/v1/inbox/?business={self.other_business.id}")

        self.assertEqual(today_response.status_code, 200)
        self.assertEqual(today_response.data["sections"]["tasks"]["total"], 1)
        self.assertEqual(today_response.data["sections"]["tasks"]["overdue"], 1)
        self.assertEqual(today_response.data["sections"]["appointments"]["total"], 1)
        self.assertEqual(actions_response.status_code, 200)
        self.assertEqual(actions_response.data["items"][0]["key"], "complete_task")
        self.assertIn("process_lead", [item["key"] for item in actions_response.data["items"]])
        self.assertEqual(inbox_response.status_code, 200)
        self.assertEqual(inbox_response.data["summary"]["unread"], 1)
        self.assertEqual(inbox_response.data["items"][0]["last_message_preview"]["text"], "Need appointment details")
        self.assertNotIn("Foreign Inbox Client", str(inbox_response.data))
        self.assertEqual(foreign_response.status_code, 400)

    def test_mobile_leads_and_notifications_are_compact_and_scoped(self):
        client = Client.objects.create(
            business=self.business,
            full_name="Searchable Lead Client",
            phone="+77010000001",
            email="lead@example.com",
        )
        hidden_client = Client.objects.create(business=self.other_business, full_name="Hidden Lead Client")
        Lead.objects.create(
            business=self.business,
            client=client,
            source=Lead.Sources.WEBSITE,
            status=Lead.Statuses.NEW,
            message="Mobile search text",
        )
        Lead.objects.create(
            business=self.other_business,
            client=hidden_client,
            source=Lead.Sources.WEBSITE,
            status=Lead.Statuses.NEW,
            message="Hidden mobile search text",
        )
        Notification.objects.create(
            business=self.business,
            recipient=self.owner,
            client=client,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.URGENT,
            text="New mobile notification",
            action_url="/app/leads",
            send_at=timezone.now(),
        )
        Notification.objects.create(
            business=self.business,
            recipient=self.other_owner,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.URGENT,
            text="Hidden recipient conversation notification",
            action_url="/app/conversations?conversation=99",
            send_at=timezone.now(),
        )
        Notification.objects.create(
            business=self.other_business,
            recipient=self.other_owner,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.URGENT,
            text="Hidden tenant notification",
            action_url="/app/leads",
            send_at=timezone.now(),
        )
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        leads_response = self.api.get(f"/api/mobile/v1/leads/?business={self.business.id}&search=searchable&status=new")
        notifications_response = self.api.get(f"/api/mobile/v1/notifications/?business={self.business.id}&unread=true")
        foreign_response = self.api.get(f"/api/mobile/v1/leads/?business={self.other_business.id}")

        self.assertEqual(leads_response.status_code, 200)
        self.assertEqual(leads_response.data["summary"]["total"], 1)
        self.assertEqual(leads_response.data["items"][0]["client"]["name"], "Searchable Lead Client")
        self.assertNotIn("Hidden Lead Client", str(leads_response.data))
        self.assertEqual(notifications_response.status_code, 200)
        self.assertEqual(notifications_response.data["summary"]["unread"], 1)
        self.assertEqual(notifications_response.data["summary"]["urgent"], 1)
        self.assertEqual(notifications_response.data["items"][0]["text"], "New mobile notification")
        self.assertNotIn("Hidden recipient conversation notification", str(notifications_response.data))
        self.assertNotIn("Hidden tenant notification", str(notifications_response.data))
        self.assertEqual(foreign_response.status_code, 400)

    def test_mobile_clients_tasks_and_appointments_are_compact_and_scoped(self):
        client = Client.objects.create(
            business=self.business,
            full_name="Mobile Directory Client",
            phone="+77010000001",
            email="directory@example.com",
            notes="VIP mobile note",
        )
        service = Service.objects.create(business=self.business, name="Mobile Calendar Service", duration_minutes=60, price_from=15000)
        lead = Lead.objects.create(business=self.business, client=client, source=Lead.Sources.WEBSITE, status=Lead.Statuses.NEW)
        Task.objects.create(
            business=self.business,
            client=client,
            lead=lead,
            title="Mobile task today",
            due_at=timezone.now() + timedelta(hours=2),
        )
        mobile_appointment_start = timezone.now() + timedelta(hours=4)
        Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=mobile_appointment_start,
            end_at=mobile_appointment_start + timedelta(hours=1),
            status=Appointment.Statuses.CREATED,
        )
        foreign_client = Client.objects.create(business=self.other_business, full_name="Foreign Directory Client")
        foreign_service = Service.objects.create(business=self.other_business, name="Foreign Service", duration_minutes=30, price_from=5000)
        Appointment.objects.create(
            business=self.other_business,
            client=foreign_client,
            service=foreign_service,
            start_at=timezone.now() + timedelta(hours=1),
            end_at=timezone.now() + timedelta(hours=2),
            status=Appointment.Statuses.CREATED,
        )
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        clients_response = self.api.get(f"/api/mobile/v1/clients/?business={self.business.id}&search=directory")
        tasks_response = self.api.get(f"/api/mobile/v1/tasks/?business={self.business.id}&due=today")
        appointments_response = self.api.get(
            f"/api/mobile/v1/appointments/?business={self.business.id}&date={timezone.localtime(mobile_appointment_start).date().isoformat()}"
        )
        foreign_response = self.api.get(f"/api/mobile/v1/clients/?business={self.other_business.id}")

        self.assertEqual(clients_response.status_code, 200)
        self.assertEqual(clients_response.data["summary"]["total"], 1)
        self.assertEqual(clients_response.data["items"][0]["title"], "Mobile Directory Client")
        self.assertEqual(tasks_response.status_code, 200)
        self.assertEqual(tasks_response.data["summary"]["today"], 1)
        self.assertEqual(tasks_response.data["items"][0]["title"], "Mobile task today")
        self.assertEqual(appointments_response.status_code, 200)
        self.assertEqual(appointments_response.data["summary"]["needs_confirmation"], 1)
        self.assertEqual(appointments_response.data["items"][0]["title"], "Mobile Directory Client")
        self.assertNotIn("Foreign Directory Client", str(clients_response.data))
        self.assertNotIn("Foreign Directory Client", str(appointments_response.data))
        self.assertEqual(foreign_response.status_code, 400)

    def test_mobile_detail_endpoints_return_compact_scoped_payloads(self):
        client = Client.objects.create(
            business=self.business,
            full_name="Mobile Detail Client",
            phone="+77019990000",
            email="detail@example.com",
            notes="Detailed client note",
        )
        service = Service.objects.create(business=self.business, name="Detail Service", duration_minutes=45, price_from=12000)
        lead = Lead.objects.create(
            business=self.business,
            client=client,
            service=service,
            source=Lead.Sources.WEBSITE,
            status=Lead.Statuses.NEW,
            message="Detail lead message",
            responsible_user=self.owner,
        )
        task = Task.objects.create(
            business=self.business,
            client=client,
            lead=lead,
            title="Detail task",
            description="Detail task description",
            due_at=timezone.now() + timedelta(hours=2),
            assignee=self.owner,
            created_by=self.owner,
        )
        task.comments.create(author=self.owner, text="Detail task comment")
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            lead=lead,
            service=service,
            start_at=timezone.now() + timedelta(days=1),
            end_at=timezone.now() + timedelta(days=1, minutes=45),
            status=Appointment.Statuses.CREATED,
            notes="Detail appointment note",
        )
        bot = Bot.objects.create(business=self.business, name="Detail Bot", status=Bot.Statuses.ACTIVE)
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            client=client,
            lead=lead,
            channel=BotConversation.Channels.WEBSITE,
            unread_count=1,
            handoff_required=True,
            last_message_at=timezone.now(),
        )
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Detail inbound message",
        )
        foreign_client = Client.objects.create(business=self.other_business, full_name="Foreign Detail Client")
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        client_response = self.api.get(f"/api/mobile/v1/clients/{client.id}/?business={self.business.id}")
        lead_response = self.api.get(f"/api/mobile/v1/leads/{lead.id}/?business={self.business.id}")
        task_response = self.api.get(f"/api/mobile/v1/tasks/{task.id}/?business={self.business.id}")
        appointment_response = self.api.get(f"/api/mobile/v1/appointments/{appointment.id}/?business={self.business.id}")
        conversation_response = self.api.get(f"/api/mobile/v1/inbox/{conversation.id}/?business={self.business.id}")
        foreign_response = self.api.get(f"/api/mobile/v1/clients/{foreign_client.id}/?business={self.business.id}")

        self.assertEqual(client_response.status_code, 200)
        self.assertEqual(client_response.data["client"]["title"], "Mobile Detail Client")
        self.assertEqual(client_response.data["related"]["leads"][0]["id"], lead.id)
        self.assertEqual(lead_response.status_code, 200)
        self.assertEqual(lead_response.data["details"]["message"], "Detail lead message")
        self.assertEqual(lead_response.data["details"]["responsible_user"]["id"], self.owner.id)
        self.assertEqual(task_response.status_code, 200)
        self.assertEqual(task_response.data["details"]["description"], "Detail task description")
        self.assertEqual(task_response.data["comments"][0]["text"], "Detail task comment")
        self.assertEqual(appointment_response.status_code, 200)
        self.assertEqual(appointment_response.data["details"]["client"]["id"], client.id)
        self.assertEqual(appointment_response.data["details"]["service"]["name"], "Detail Service")
        self.assertEqual(conversation_response.status_code, 200)
        self.assertEqual(conversation_response.data["details"]["client"]["id"], client.id)
        self.assertEqual(conversation_response.data["messages"][0]["text"], "Detail inbound message")
        self.assertNotIn("Foreign Detail Client", str(client_response.data))
        self.assertEqual(foreign_response.status_code, 404)

    def test_mobile_push_delivery_plan_is_targeted_and_redacts_notification_text(self):
        manager = User.objects.create_user(
            username="mobile-push-manager",
            email="mobile-push-manager@example.com",
            password="StrongPass123",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=manager, role=BusinessMember.Roles.MANAGER)
        owner_device = MobileDevice.objects.create(
            business=self.business,
            user=self.owner,
            device_id_hash=hash_mobile_secret("owner-ios", namespace="mobile-device"),
            platform=MobileDevice.Platforms.IOS,
        )
        manager_device = MobileDevice.objects.create(
            business=self.business,
            user=manager,
            device_id_hash=hash_mobile_secret("manager-ios", namespace="mobile-device"),
            platform=MobileDevice.Platforms.IOS,
        )
        MobilePushToken.objects.create(
            business=self.business,
            user=self.owner,
            device=owner_device,
            provider=MobilePushToken.Providers.EXPO,
            token_hash=hash_mobile_secret("ExponentPushToken[owner]", namespace="mobile-push"),
            encrypted_token=encrypt_credential_value("ExponentPushToken[owner]"),
            is_active=True,
            last_seen_at=timezone.now(),
        )
        MobilePushToken.objects.create(
            business=self.business,
            user=manager,
            device=manager_device,
            provider=MobilePushToken.Providers.EXPO,
            token_hash=hash_mobile_secret("ExponentPushToken[manager]", namespace="mobile-push"),
            encrypted_token=encrypt_credential_value("ExponentPushToken[manager]"),
            is_active=True,
            last_seen_at=timezone.now(),
        )
        notification = Notification.objects.create(
            business=self.business,
            recipient=manager,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.URGENT,
            text="Sensitive client says: secret appointment details",
            action_url="/app/leads",
            send_at=timezone.now(),
        )

        messages = build_mobile_push_messages(notification)
        result = deliver_mobile_push_notification(notification, dry_run=True)

        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["to"], "ExponentPushToken[manager]")
        self.assertNotIn("secret appointment details", str(messages))
        self.assertEqual(result["status"], "planned")
        self.assertEqual(result["count"], 1)

    def test_mobile_push_respects_preferences_and_privacy_mode(self):
        device = MobileDevice.objects.create(
            business=self.business,
            user=self.owner,
            device_id_hash=hash_mobile_secret("owner-pref-ios", namespace="mobile-device"),
            platform=MobileDevice.Platforms.IOS,
        )
        MobilePushToken.objects.create(
            business=self.business,
            user=self.owner,
            device=device,
            provider=MobilePushToken.Providers.EXPO,
            token_hash=hash_mobile_secret("ExponentPushToken[pref-owner]", namespace="mobile-push"),
            encrypted_token=encrypt_credential_value("ExponentPushToken[pref-owner]"),
            is_active=True,
            last_seen_at=timezone.now(),
        )
        NotificationPreference.objects.create(
            business=self.business,
            user=self.owner,
            category=Notification.Categories.SALES,
            push_enabled=False,
        )
        normal = Notification.objects.create(
            business=self.business,
            recipient=self.owner,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.NORMAL,
            text="Normal sales update",
            send_at=timezone.now(),
        )
        urgent = Notification.objects.create(
            business=self.business,
            recipient=self.owner,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.URGENT,
            text="Urgent sales update",
            send_at=timezone.now(),
        )

        self.assertEqual(build_mobile_push_messages(normal), [])
        self.assertEqual(len(build_mobile_push_messages(urgent)), 1)

        preference = NotificationPreference.objects.get(business=self.business, user=self.owner, category=Notification.Categories.SALES)
        preference.push_enabled = True
        preference.privacy_mode = NotificationPreference.PrivacyModes.FULL
        preference.save(update_fields=["push_enabled", "privacy_mode", "updated_at"])
        visible = Notification.objects.create(
            business=self.business,
            recipient=self.owner,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.NORMAL,
            text="Allowed client context",
            send_at=timezone.now(),
        )

        messages = build_mobile_push_messages(visible)

        self.assertEqual(messages[0]["body"], "Allowed client context")

    def test_mobile_notification_preferences_are_scoped_and_upserted(self):
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        list_response = self.api.get(f"/api/mobile/v1/notification-preferences/?business={self.business.id}")
        update_response = self.api.post(
            "/api/mobile/v1/notification-preferences/",
            {
                "business": self.business.id,
                "category": Notification.Categories.TASKS,
                "push_enabled": False,
                "privacy_mode": NotificationPreference.PrivacyModes.FULL,
            },
            format="json",
        )
        foreign_response = self.api.get(f"/api/mobile/v1/notification-preferences/?business={self.other_business.id}")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data["items"]), len(Notification.Categories.values))
        self.assertEqual(update_response.status_code, 200)
        task_item = next(item for item in update_response.data["items"] if item["category"] == Notification.Categories.TASKS)
        self.assertFalse(task_item["push_enabled"])
        self.assertEqual(task_item["privacy_mode"], NotificationPreference.PrivacyModes.FULL)
        self.assertEqual(foreign_response.status_code, 400)

    def test_mobile_device_list_and_revoke_are_user_and_business_scoped(self):
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        device = MobileDevice.objects.get(user=self.owner, business=self.business)
        session = MobileSession.objects.get(user=self.owner, business=self.business, device=device)
        push_token = MobilePushToken.objects.create(
            business=self.business,
            user=self.owner,
            device=device,
            provider=MobilePushToken.Providers.EXPO,
            token_hash=hash_mobile_secret("ExponentPushToken[owner-device]", namespace="mobile-push"),
            encrypted_token=encrypt_credential_value("ExponentPushToken[owner-device]"),
            is_active=True,
            last_seen_at=timezone.now(),
        )
        foreign_device = MobileDevice.objects.create(
            business=self.other_business,
            user=self.other_owner,
            device_id_hash=hash_mobile_secret("foreign-ios", namespace="mobile-device"),
            platform=MobileDevice.Platforms.IOS,
        )

        list_response = self.api.get(f"/api/mobile/v1/devices/?business={self.business.id}")
        foreign_list_response = self.api.get(f"/api/mobile/v1/devices/?business={self.other_business.id}")
        foreign_revoke_response = self.api.post(
            f"/api/mobile/v1/devices/{foreign_device.id}/revoke/",
            {"business": self.business.id},
            format="json",
        )
        revoke_response = self.api.post(
            f"/api/mobile/v1/devices/{device.id}/revoke/",
            {"business": self.business.id},
            format="json",
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual([item["id"] for item in list_response.data["items"]], [device.id])
        self.assertNotIn(foreign_device.id, [item["id"] for item in list_response.data["items"]])
        self.assertEqual(foreign_list_response.status_code, 400)
        self.assertEqual(foreign_revoke_response.status_code, 404)
        self.assertEqual(revoke_response.status_code, 200)
        device.refresh_from_db()
        session.refresh_from_db()
        push_token.refresh_from_db()
        self.assertIsNotNone(device.revoked_at)
        self.assertEqual(session.status, MobileSession.Statuses.REVOKED)
        self.assertFalse(push_token.is_active)

    def test_mobile_task_complete_requires_and_replays_idempotency_key(self):
        client = Client.objects.create(business=self.business, full_name="Task Mobile Client")
        task = Task.objects.create(
            business=self.business,
            client=client,
            title="Complete from mobile",
            status=Task.Statuses.OPEN,
            assignee=self.owner,
        )
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        missing_key_response = self.api.post(
            f"/api/mobile/v1/tasks/{task.id}/complete/",
            {"business": self.business.id},
            format="json",
        )
        first_response = self.api.post(
            f"/api/mobile/v1/tasks/{task.id}/complete/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="complete-task-1",
        )
        replay_response = self.api.post(
            f"/api/mobile/v1/tasks/{task.id}/complete/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="complete-task-1",
        )
        mismatched_response = self.api.post(
            f"/api/mobile/v1/tasks/{task.id}/complete/",
            {"business": self.business.id, "extra": "different"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="complete-task-1",
        )

        task.refresh_from_db()
        self.assertEqual(missing_key_response.status_code, 400)
        self.assertEqual(first_response.status_code, 200)
        self.assertFalse(first_response.data["replayed"])
        self.assertEqual(replay_response.status_code, 200)
        self.assertTrue(replay_response.data["replayed"])
        self.assertEqual(mismatched_response.status_code, 400)
        self.assertEqual(task.status, Task.Statuses.DONE)
        self.assertEqual(MobileIdempotencyKey.objects.filter(business=self.business, user=self.owner).count(), 1)
        self.assertEqual(Notification.objects.filter(business=self.business, category=Notification.Categories.TASKS, text__startswith="Задача выполнена").count(), 1)
        self.assertEqual(ActivityEvent.objects.filter(business=self.business, event_type="task_completed", entity_id=str(task.id)).count(), 1)

    def test_mobile_write_rejects_stale_expected_updated_at_before_action(self):
        client = Client.objects.create(business=self.business, full_name="Stale Mobile Client")
        task = Task.objects.create(
            business=self.business,
            client=client,
            title="Stale from mobile",
            status=Task.Statuses.OPEN,
            assignee=self.owner,
        )
        expected_updated_at = task.updated_at.isoformat()
        task.title = "Changed before replay"
        task.save(update_fields=["title", "updated_at"])
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.api.post(
            f"/api/mobile/v1/tasks/{task.id}/complete/",
            {"business": self.business.id, "expected_updated_at": expected_updated_at},
            format="json",
            HTTP_IDEMPOTENCY_KEY="stale-task-complete",
        )

        task.refresh_from_db()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "stale_state")
        self.assertNotEqual(task.status, Task.Statuses.DONE)
        self.assertFalse(MobileIdempotencyKey.objects.filter(business=self.business, user=self.owner, endpoint="mobile.tasks.complete").exists())

    def test_mobile_lead_assign_requires_and_replays_idempotency_key(self):
        client = Client.objects.create(business=self.business, full_name="Mobile Assign Lead Client")
        lead = Lead.objects.create(
            business=self.business,
            client=client,
            source=Lead.Sources.WEBSITE,
            status=Lead.Statuses.NEW,
        )
        foreign_client = Client.objects.create(business=self.other_business, full_name="Foreign Assign Lead Client")
        foreign_lead = Lead.objects.create(
            business=self.other_business,
            client=foreign_client,
            source=Lead.Sources.WEBSITE,
            status=Lead.Statuses.NEW,
        )
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        missing_key_response = self.api.post(
            f"/api/mobile/v1/leads/{lead.id}/assign/",
            {"business": self.business.id},
            format="json",
        )
        first_response = self.api.post(
            f"/api/mobile/v1/leads/{lead.id}/assign/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="assign-lead-1",
        )
        replay_response = self.api.post(
            f"/api/mobile/v1/leads/{lead.id}/assign/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="assign-lead-1",
        )
        foreign_response = self.api.post(
            f"/api/mobile/v1/leads/{foreign_lead.id}/assign/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="assign-lead-foreign",
        )

        lead.refresh_from_db()
        self.assertEqual(missing_key_response.status_code, 400)
        self.assertEqual(first_response.status_code, 200)
        self.assertFalse(first_response.data["replayed"])
        self.assertEqual(first_response.data["lead"]["responsible_user_id"], self.owner.id)
        self.assertEqual(replay_response.status_code, 200)
        self.assertTrue(replay_response.data["replayed"])
        self.assertEqual(foreign_response.status_code, 404)
        self.assertEqual(lead.responsible_user_id, self.owner.id)
        self.assertEqual(
            MobileIdempotencyKey.objects.filter(business=self.business, user=self.owner, endpoint="mobile.leads.assign").count(),
            1,
        )
        self.assertEqual(ActivityEvent.objects.filter(business=self.business, event_type="lead_assigned", entity_id=str(lead.id)).count(), 1)

    def test_mobile_lead_qualify_requires_and_replays_idempotency_key(self):
        client = Client.objects.create(business=self.business, full_name="Mobile Qualify Lead Client")
        lead = Lead.objects.create(
            business=self.business,
            client=client,
            source=Lead.Sources.WEBSITE,
            status=Lead.Statuses.NEW,
        )
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        missing_key_response = self.api.post(
            f"/api/mobile/v1/leads/{lead.id}/qualify/",
            {"business": self.business.id},
            format="json",
        )
        first_response = self.api.post(
            f"/api/mobile/v1/leads/{lead.id}/qualify/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="qualify-lead-1",
        )
        replay_response = self.api.post(
            f"/api/mobile/v1/leads/{lead.id}/qualify/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="qualify-lead-1",
        )
        mismatched_response = self.api.post(
            f"/api/mobile/v1/leads/{lead.id}/qualify/",
            {"business": self.business.id, "extra": "different"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="qualify-lead-1",
        )

        lead.refresh_from_db()
        self.assertEqual(missing_key_response.status_code, 400)
        self.assertEqual(first_response.status_code, 200)
        self.assertFalse(first_response.data["replayed"])
        self.assertEqual(first_response.data["lead"]["status"], Lead.Statuses.IN_PROGRESS)
        self.assertEqual(first_response.data["lead"]["responsible_user_id"], self.owner.id)
        self.assertEqual(replay_response.status_code, 200)
        self.assertTrue(replay_response.data["replayed"])
        self.assertEqual(mismatched_response.status_code, 400)
        self.assertEqual(lead.status, Lead.Statuses.IN_PROGRESS)
        self.assertEqual(lead.responsible_user_id, self.owner.id)
        self.assertEqual(
            MobileIdempotencyKey.objects.filter(business=self.business, user=self.owner, endpoint="mobile.leads.qualify").count(),
            1,
        )
        self.assertEqual(ActivityEvent.objects.filter(business=self.business, event_type="lead_taken_in_work", entity_id=str(lead.id)).count(), 1)

    def test_mobile_ai_approval_actions_and_decisions_are_idempotent_and_scoped(self):
        approval = ApprovalRequest.objects.create(
            business=self.business,
            requested_by=self.owner,
            action_type=ApprovalRequest.ActionTypes.AI_AUTOMATION,
            source_object_type="AutomationRule",
            source_object_id="1",
        )
        reject_approval = ApprovalRequest.objects.create(
            business=self.business,
            requested_by=self.owner,
            action_type=ApprovalRequest.ActionTypes.AI_AUTOMATION,
            source_object_type="AutomationRule",
            source_object_id="2",
        )
        foreign_approval = ApprovalRequest.objects.create(
            business=self.other_business,
            requested_by=self.other_owner,
            action_type=ApprovalRequest.ActionTypes.AI_AUTOMATION,
            source_object_type="AutomationRule",
            source_object_id="3",
        )
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        actions_response = self.api.get(f"/api/mobile/v1/actions/?business={self.business.id}")
        missing_key_response = self.api.post(
            f"/api/mobile/v1/ai/approval-requests/{approval.id}/approve/",
            {"business": self.business.id},
            format="json",
        )
        first_response = self.api.post(
            f"/api/mobile/v1/ai/approval-requests/{approval.id}/approve/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="approve-ai-1",
        )
        replay_response = self.api.post(
            f"/api/mobile/v1/ai/approval-requests/{approval.id}/approve/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="approve-ai-1",
        )
        mismatched_response = self.api.post(
            f"/api/mobile/v1/ai/approval-requests/{approval.id}/approve/",
            {"business": self.business.id, "reason": "different"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="approve-ai-1",
        )
        reject_response = self.api.post(
            f"/api/mobile/v1/ai/approval-requests/{reject_approval.id}/reject/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="reject-ai-1",
        )
        foreign_response = self.api.post(
            f"/api/mobile/v1/ai/approval-requests/{foreign_approval.id}/approve/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="approve-ai-foreign",
        )

        approval.refresh_from_db()
        reject_approval.refresh_from_db()
        self.assertEqual(actions_response.status_code, 200)
        self.assertIn("approve_ai_request", [item["key"] for item in actions_response.data["items"]])
        approval_action_ids = [item["entity"]["id"] for item in actions_response.data["items"] if item["key"] == "approve_ai_request"]
        self.assertEqual(set(approval_action_ids), {approval.id, reject_approval.id})
        self.assertNotIn(foreign_approval.id, approval_action_ids)
        self.assertEqual(missing_key_response.status_code, 400)
        self.assertEqual(first_response.status_code, 200)
        self.assertFalse(first_response.data["replayed"])
        self.assertEqual(first_response.data["approval"]["status"], ApprovalRequest.Statuses.APPROVED)
        self.assertEqual(replay_response.status_code, 200)
        self.assertTrue(replay_response.data["replayed"])
        self.assertEqual(mismatched_response.status_code, 400)
        self.assertEqual(reject_response.status_code, 200)
        self.assertEqual(reject_response.data["approval"]["status"], ApprovalRequest.Statuses.REJECTED)
        self.assertEqual(foreign_response.status_code, 404)
        self.assertEqual(approval.status, ApprovalRequest.Statuses.APPROVED)
        self.assertEqual(approval.approved_by, self.owner)
        self.assertEqual(reject_approval.status, ApprovalRequest.Statuses.REJECTED)
        self.assertEqual(reject_approval.rejected_by, self.owner)
        self.assertEqual(
            MobileIdempotencyKey.objects.filter(business=self.business, user=self.owner, endpoint__startswith="mobile.ai_approvals").count(),
            2,
        )

    def test_mobile_notification_mark_read_requires_and_replays_idempotency_key(self):
        notification = Notification.objects.create(
            business=self.business,
            recipient=self.owner,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.HIGH,
            text="Mobile read state",
            send_at=timezone.now(),
            action_url="/app/leads",
        )
        hidden_notification = Notification.objects.create(
            business=self.business,
            recipient=self.other_owner,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            text="Hidden conversation",
            send_at=timezone.now(),
            action_url="/app/conversations/1",
        )
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        missing_key_response = self.api.post(
            f"/api/mobile/v1/notifications/{notification.id}/mark-read/",
            {"business": self.business.id},
            format="json",
        )
        first_response = self.api.post(
            f"/api/mobile/v1/notifications/{notification.id}/mark-read/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="mark-read-1",
        )
        replay_response = self.api.post(
            f"/api/mobile/v1/notifications/{notification.id}/mark-read/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="mark-read-1",
        )
        hidden_response = self.api.post(
            f"/api/mobile/v1/notifications/{hidden_notification.id}/mark-read/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="mark-read-hidden",
        )

        notification.refresh_from_db()
        self.assertEqual(missing_key_response.status_code, 400)
        self.assertEqual(first_response.status_code, 200)
        self.assertFalse(first_response.data["replayed"])
        self.assertEqual(first_response.data["notification"]["id"], notification.id)
        self.assertIsNotNone(notification.read_at)
        self.assertEqual(replay_response.status_code, 200)
        self.assertTrue(replay_response.data["replayed"])
        self.assertEqual(hidden_response.status_code, 404)
        self.assertEqual(
            MobileIdempotencyKey.objects.filter(business=self.business, user=self.owner, endpoint="mobile.notifications.mark_read").count(),
            1,
        )

    def test_mobile_inbox_reply_requires_idempotency_and_is_scoped(self):
        client = Client.objects.create(business=self.business, full_name="Reply Mobile Client")
        bot = Bot.objects.create(business=self.business, name="Reply Bot", status=Bot.Statuses.ACTIVE)
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=bot,
            client=client,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="reply-client",
        )
        other_bot = Bot.objects.create(business=self.other_business, name="Other Reply Bot", status=Bot.Statuses.ACTIVE)
        foreign_conversation = BotConversation.objects.create(
            business=self.other_business,
            bot=other_bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="foreign-reply-client",
        )
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        missing_key_response = self.api.post(
            f"/api/mobile/v1/inbox/{conversation.id}/reply/",
            {"business": self.business.id, "text": "Mobile reply"},
            format="json",
        )
        first_response = self.api.post(
            f"/api/mobile/v1/inbox/{conversation.id}/reply/",
            {"business": self.business.id, "text": "Mobile reply"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="reply-1",
        )
        replay_response = self.api.post(
            f"/api/mobile/v1/inbox/{conversation.id}/reply/",
            {"business": self.business.id, "text": "Mobile reply"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="reply-1",
        )
        foreign_response = self.api.post(
            f"/api/mobile/v1/inbox/{foreign_conversation.id}/reply/",
            {"business": self.business.id, "text": "Foreign reply"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="reply-foreign",
        )

        self.assertEqual(missing_key_response.status_code, 400)
        self.assertEqual(first_response.status_code, 200)
        self.assertFalse(first_response.data["replayed"])
        self.assertEqual(first_response.data["message"]["text"], "Mobile reply")
        self.assertEqual(replay_response.status_code, 200)
        self.assertTrue(replay_response.data["replayed"])
        self.assertEqual(foreign_response.status_code, 404)
        self.assertEqual(BotMessage.objects.filter(conversation=conversation, direction=BotMessage.Directions.OUTBOUND).count(), 1)
        self.assertEqual(
            MobileIdempotencyKey.objects.filter(business=self.business, user=self.owner, endpoint="mobile.inbox.reply").count(),
            1,
        )

    def test_mobile_task_assign_cancel_and_snooze_are_idempotent(self):
        client = Client.objects.create(business=self.business, full_name="Task Action Mobile Client")
        assign_task_item = Task.objects.create(business=self.business, client=client, title="Assign from mobile")
        cancel_task_item = Task.objects.create(business=self.business, client=client, title="Cancel from mobile", assignee=self.owner)
        snooze_task_item = Task.objects.create(business=self.business, client=client, title="Snooze from mobile", assignee=self.owner)
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        snoozed_until = (timezone.now() + timedelta(hours=4)).isoformat()

        assign_response = self.api.post(
            f"/api/mobile/v1/tasks/{assign_task_item.id}/assign-to-me/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="assign-task-me-1",
        )
        cancel_response = self.api.post(
            f"/api/mobile/v1/tasks/{cancel_task_item.id}/cancel/",
            {"business": self.business.id, "reason": "No longer needed"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="cancel-task-1",
        )
        snooze_response = self.api.post(
            f"/api/mobile/v1/tasks/{snooze_task_item.id}/snooze/",
            {"business": self.business.id, "snoozed_until": snoozed_until},
            format="json",
            HTTP_IDEMPOTENCY_KEY="snooze-task-1",
        )
        snooze_replay_response = self.api.post(
            f"/api/mobile/v1/tasks/{snooze_task_item.id}/snooze/",
            {"business": self.business.id, "snoozed_until": snoozed_until},
            format="json",
            HTTP_IDEMPOTENCY_KEY="snooze-task-1",
        )

        assign_task_item.refresh_from_db()
        cancel_task_item.refresh_from_db()
        snooze_task_item.refresh_from_db()
        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(assign_task_item.assignee, self.owner)
        self.assertEqual(assign_task_item.status, Task.Statuses.IN_PROGRESS)
        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(cancel_task_item.status, Task.Statuses.CANCELLED)
        self.assertEqual(snooze_response.status_code, 200)
        self.assertIsNotNone(snooze_task_item.snoozed_until)
        self.assertEqual(snooze_replay_response.status_code, 200)
        self.assertTrue(snooze_replay_response.data["replayed"])

    def test_mobile_appointment_cancel_and_reschedule_are_idempotent(self):
        client = Client.objects.create(business=self.business, full_name="Appointment Action Client")
        service = Service.objects.create(business=self.business, name="Mobile Reschedule Service", duration_minutes=30, price_from=9000)
        for weekday in range(7):
            WorkingHours.objects.create(
                business=self.business,
                weekday=weekday,
                start_time="09:00",
                end_time="21:00",
                is_day_off=False,
            )
        cancel_appointment_item = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=timezone.now() + timedelta(days=1, hours=2),
            end_at=timezone.now() + timedelta(days=1, hours=3),
            status=Appointment.Statuses.CREATED,
        )
        reschedule_appointment_item = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=timezone.now() + timedelta(days=2, hours=2),
            end_at=timezone.now() + timedelta(days=2, hours=3),
            status=Appointment.Statuses.CREATED,
        )
        new_start = (timezone.now() + timedelta(days=3)).replace(hour=10, minute=0, second=0, microsecond=0)
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        cancel_response = self.api.post(
            f"/api/mobile/v1/appointments/{cancel_appointment_item.id}/cancel/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="cancel-appointment-1",
        )
        reschedule_response = self.api.post(
            f"/api/mobile/v1/appointments/{reschedule_appointment_item.id}/reschedule/",
            {"business": self.business.id, "start_at": new_start.isoformat()},
            format="json",
            HTTP_IDEMPOTENCY_KEY="reschedule-appointment-1",
        )
        reschedule_replay_response = self.api.post(
            f"/api/mobile/v1/appointments/{reschedule_appointment_item.id}/reschedule/",
            {"business": self.business.id, "start_at": new_start.isoformat()},
            format="json",
            HTTP_IDEMPOTENCY_KEY="reschedule-appointment-1",
        )

        cancel_appointment_item.refresh_from_db()
        reschedule_appointment_item.refresh_from_db()
        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(cancel_appointment_item.status, Appointment.Statuses.CANCELLED)
        self.assertEqual(reschedule_response.status_code, 200)
        self.assertEqual(reschedule_appointment_item.start_at.replace(microsecond=0), new_start.replace(microsecond=0))
        self.assertEqual(reschedule_replay_response.status_code, 200)
        self.assertTrue(reschedule_replay_response.data["replayed"])

    def test_mobile_appointment_confirm_requires_and_replays_idempotency_key(self):
        client = Client.objects.create(business=self.business, full_name="Appointment Mobile Client")
        service = Service.objects.create(business=self.business, name="Mobile Confirm Service", duration_minutes=30, price_from=9000)
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=timezone.now() + timedelta(hours=2),
            end_at=timezone.now() + timedelta(hours=3),
            status=Appointment.Statuses.CREATED,
        )
        login_response = self.mobile_login()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        missing_key_response = self.api.post(
            f"/api/mobile/v1/appointments/{appointment.id}/confirm/",
            {"business": self.business.id},
            format="json",
        )
        first_response = self.api.post(
            f"/api/mobile/v1/appointments/{appointment.id}/confirm/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="confirm-appointment-1",
        )
        replay_response = self.api.post(
            f"/api/mobile/v1/appointments/{appointment.id}/confirm/",
            {"business": self.business.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY="confirm-appointment-1",
        )
        mismatched_response = self.api.post(
            f"/api/mobile/v1/appointments/{appointment.id}/confirm/",
            {"business": self.business.id, "extra": "different"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="confirm-appointment-1",
        )

        appointment.refresh_from_db()
        self.assertEqual(missing_key_response.status_code, 400)
        self.assertEqual(first_response.status_code, 200)
        self.assertFalse(first_response.data["replayed"])
        self.assertEqual(first_response.data["appointment"]["status"], Appointment.Statuses.CONFIRMED)
        self.assertEqual(replay_response.status_code, 200)
        self.assertTrue(replay_response.data["replayed"])
        self.assertEqual(mismatched_response.status_code, 400)
        self.assertEqual(appointment.status, Appointment.Statuses.CONFIRMED)
        self.assertEqual(
            MobileIdempotencyKey.objects.filter(business=self.business, user=self.owner, endpoint="mobile.appointments.confirm").count(),
            1,
        )
        self.assertEqual(
            ActivityEvent.objects.filter(business=self.business, event_type="appointment_confirmed", entity_id=str(appointment.id)).count(),
            1,
        )
