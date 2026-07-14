from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.accounts.models import User
from apps.ai_core.models import AIToolCallLog
from apps.crm.models import Deal
from apps.scheduling.models import Appointment
from apps.businesses.activation import activate_landing_business
from apps.businesses.models import Business, BusinessMember
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.clients.models import Client
from apps.conversations.models import QuickReplyTemplate
from apps.integrations.models import BusinessConnector, BusinessEvent
from apps.leads.forms_service import submit_lead_form
from apps.leads.models import Lead, LeadForm
from apps.notifications.models import Notification
from apps.onboarding.services import create_demo_data
from apps.conversations.models import Conversation
from apps.services.models import Service
from apps.tasks.models import Task


class Command(BaseCommand):
    help = "Seed a complete ZANI pilot demo merchant for sales/staging smoke checks."

    def add_arguments(self, parser):
        parser.add_argument("--landing-id", default="demo-pilot-landing-001")
        parser.add_argument("--business-name", default="ZANI Demo Beauty")
        parser.add_argument("--owner-email", default="demo-owner@zani.local")
        parser.add_argument("--owner-password", default="DemoOwner123!")
        parser.add_argument("--manager-email", default="demo-manager@zani.local")
        parser.add_argument("--manager-password", default="DemoManager123!")
        parser.add_argument("--reset", action="store_true", help="Delete existing demo business for this landing id before seeding.")
        parser.add_argument("--show-passwords", action="store_true", help="Print demo passwords in command output.")

    @transaction.atomic
    def handle(self, *args, **options):
        landing_id = options["landing_id"]
        if options["reset"]:
            self._reset_demo_businesses(landing_id)

        result = activate_landing_business(
            landing_id=landing_id,
            owner_email=options["owner_email"],
            owner_password=options["owner_password"],
            owner_full_name="Demo Owner",
            business_name=options["business_name"],
            business_type=Business.BusinessTypes.BEAUTY,
            landing_domain="demo.zani.local",
            landing_preview_url="https://demo.zani.local/preview",
            city="Алматы",
            phone="+77000000001",
        )
        business = result.business
        owner = result.owner
        manager = self._ensure_manager(business, options["manager_email"], options["manager_password"])
        services = self._ensure_services(business)
        create_demo_data(business, actor=owner)
        self._ensure_connectors(business, owner)
        self._ensure_sales_events(business)
        self._ensure_demo_leads(result.lead_form, manager)
        self._ensure_inbox(business, manager)
        self._ensure_ai_action(business, owner, manager)
        self._ensure_quick_replies(business)

        self.stdout.write(self.style.SUCCESS("ZANI pilot demo seeded."))
        self.stdout.write(f"Business: {business.id} / {business.name} / {business.slug}")
        self.stdout.write(f"Owner login: {options['owner_email']} / {self._display_password(options['owner_password'], options['show_passwords'])}")
        self.stdout.write(f"Manager login: {options['manager_email']} / {self._display_password(options['manager_password'], options['show_passwords'])}")
        self.stdout.write(f"Landing form public_id: {result.lead_form.public_id}")
        self.stdout.write(f"Services: {len(services)}")
        self.stdout.write("Smoke path: login as owner → dashboard → leads → inbox → AI action task.")

    def _display_password(self, password: str, show_passwords: bool) -> str:
        if show_passwords:
            return password
        return "[hidden; pass --show-passwords to print]"

    def _reset_demo_businesses(self, landing_id: str) -> None:
        """Delete an existing demo merchant safely before reseeding.

        Some demo objects intentionally use PROTECT foreign keys (for example
        Lead/Deal/Appointment/Notification -> Client and Deal -> PipelineStage).
        Deleting Business directly can therefore fail after the demo has already
        been used.  For --reset we remove the protected child objects first, then
        let Business cascades clean up the rest.
        """
        businesses = list(Business.objects.filter(landing_id=landing_id))
        if not businesses:
            return

        for business in businesses:
            # Remove client-protecting objects first.
            Notification.objects.filter(business=business).delete()
            Conversation.objects.filter(business=business).delete()
            Appointment.objects.filter(business=business).delete()
            Deal.objects.filter(business=business).delete()
            Lead.objects.filter(business=business).delete()

            # Remaining relations are CASCADE/SET_NULL and are safe to delete
            # together with the business.
            business.delete()

    def _ensure_manager(self, business: Business, email: str, password: str):
        username = self._unique_username(email.split("@")[0] or "demo-manager")
        manager, _ = User.objects.get_or_create(
            email=email,
            defaults={
                "username": username,
                "role": User.Roles.BUSINESS_MANAGER,
                "full_name": "Demo Manager",
                "is_active": True,
            },
        )
        manager.username = manager.username or self._unique_username(email.split("@")[0] or "demo-manager")
        manager.role = User.Roles.BUSINESS_MANAGER
        manager.full_name = manager.full_name or "Demo Manager"
        manager.is_active = True
        manager.set_password(password)
        manager.save(update_fields=["username", "role", "full_name", "is_active", "password"])
        BusinessMember.objects.update_or_create(
            business=business,
            user=manager,
            defaults={"role": BusinessMember.Roles.MANAGER, "is_active": True},
        )
        return manager

    def _unique_username(self, base: str) -> str:
        slug = slugify(base) or "demo-manager"
        username = slug
        index = 2
        while User.objects.filter(username=username).exists():
            username = f"{slug}-{index}"
            index += 1
        return username

    def _ensure_services(self, business: Business):
        specs = [
            ("Стрижка", "Быстрая услуга для walk-in клиентов", 45, Decimal("7000")),
            ("Окрашивание", "Высокий чек, требует записи", 120, Decimal("28000")),
            ("Уход", "Повторные продажи и retention", 60, Decimal("15000")),
        ]
        services = []
        for name, description, duration, price in specs:
            service, _ = Service.objects.update_or_create(
                business=business,
                name=name,
                defaults={
                    "description": description,
                    "duration_minutes": duration,
                    "price_from": price,
                    "is_active": True,
                },
            )
            services.append(service)
        return services

    def _ensure_connectors(self, business: Business, owner):
        specs = [
            (BusinessConnector.Providers.WEBSITE, BusinessConnector.Capabilities.SALES, "Website / Landing forms", BusinessConnector.Statuses.CONNECTED, BusinessConnector.AuthTypes.NONE),
            (BusinessConnector.Providers.EXCEL_CSV, BusinessConnector.Capabilities.SALES, "Excel / CSV sales import", BusinessConnector.Statuses.CONNECTED, BusinessConnector.AuthTypes.NONE),
            (BusinessConnector.Providers.TELEGRAM, BusinessConnector.Capabilities.COMMUNICATIONS, "Telegram beta", BusinessConnector.Statuses.NEEDS_ATTENTION, BusinessConnector.AuthTypes.TOKEN),
            (BusinessConnector.Providers.WHATSAPP, BusinessConnector.Capabilities.COMMUNICATIONS, "WhatsApp button / beta", BusinessConnector.Statuses.NEEDS_ATTENTION, BusinessConnector.AuthTypes.QR),
        ]
        for provider, capability, name, status, auth_type in specs:
            connector, _ = BusinessConnector.objects.update_or_create(
                business=business,
                provider=provider,
                name=name,
                defaults={
                    "capability": capability,
                    "status": status,
                    "auth_type": auth_type,
                    "created_by": owner,
                    "connected_at": timezone.now() if status == BusinessConnector.Statuses.CONNECTED else None,
                    "config_json": {"demo": True, "pilot_safe": provider in {BusinessConnector.Providers.WEBSITE, BusinessConnector.Providers.EXCEL_CSV}},
                },
            )
            BusinessEvent.objects.get_or_create(
                business=business,
                connector=connector,
                source=provider,
                event_type="channel_connected" if status == BusinessConnector.Statuses.CONNECTED else "channel_ready_for_setup",
                deduplication_key=f"demo-{provider}-connector",
                defaults={"payload_json": {"connector_id": connector.id, "status": status}},
            )

    def _ensure_sales_events(self, business: Business):
        sales = [
            ("demo-sale-001", "Стрижка", "instagram", "Demo Manager", Decimal("7000")),
            ("demo-sale-002", "Окрашивание", "landing", "Demo Manager", Decimal("28000")),
            ("demo-sale-003", "Уход", "whatsapp", "Demo Manager", Decimal("15000")),
        ]
        for index, (external_id, item, channel, employee, amount) in enumerate(sales):
            BusinessEvent.objects.update_or_create(
                business=business,
                source=BusinessConnector.Providers.EXCEL_CSV,
                deduplication_key=external_id,
                defaults={
                    "event_type": "sale.recorded",
                    "external_id": external_id,
                    "occurred_at": timezone.now() - timezone.timedelta(hours=index * 3),
                    "payload_json": {
                        "amount": str(amount),
                        "item": item,
                        "channel": channel,
                        "employee": employee,
                        "demo": True,
                    },
                    "status": BusinessEvent.Statuses.PROCESSED,
                    "processed_at": timezone.now(),
                },
            )

    def _ensure_demo_leads(self, lead_form: LeadForm, manager):
        submissions = [
            {"full_name": "Айгерим", "phone": "+77010000011", "message": "Хочу записаться на окрашивание", "utm_source": "instagram", "utm_campaign": "demo"},
            {"full_name": "Мадина", "phone": "+77010000012", "message": "Есть свободное время сегодня?", "utm_source": "landing", "utm_campaign": "demo"},
            {"full_name": "Алина", "phone": "+77010000013", "message": "Интересует уход", "utm_source": "whatsapp", "utm_campaign": "demo"},
        ]
        existing = lead_form.business.leads.filter(message__icontains="demo-seed").count()
        if existing >= len(submissions):
            return
        for payload in submissions:
            payload = {**payload, "landing_id": lead_form.landing_id, "source": "landing", "notes": f"{payload['message']} / demo-seed"}
            submission = submit_lead_form(lead_form=lead_form, payload=payload)
            lead = submission.lead
            lead.responsible_user = manager
            lead.message = f"{lead.message}\n\ndemo-seed"
            lead.save(update_fields=["responsible_user", "message", "updated_at"])

    def _ensure_inbox(self, business: Business, manager):
        bot, _ = Bot.objects.update_or_create(
            business=business,
            name="ZANI Demo Assistant",
            defaults={"status": Bot.Statuses.ACTIVE, "default_language": "ru", "settings_json": {"demo": True}},
        )
        BotChannel.objects.update_or_create(
            bot=bot,
            channel=BotChannel.Channels.WEBSITE,
            defaults={"status": BotChannel.Statuses.ACTIVE, "external_id": "demo-website-chat", "config_json": {"demo": True}},
        )
        BotChannel.objects.update_or_create(
            bot=bot,
            channel=BotChannel.Channels.TELEGRAM,
            defaults={"status": BotChannel.Statuses.PAUSED, "external_id": "demo-telegram", "config_json": {"demo": True, "pilot_status": "beta"}},
        )
        client, _ = Client.objects.get_or_create(
            business=business,
            phone="+77010000022",
            defaults={"full_name": "Клиент из чата", "source": Client.Sources.WEBSITE},
        )
        conversation, _ = BotConversation.objects.update_or_create(
            business=business,
            bot=bot,
            external_thread_id="demo-website-thread-001",
            defaults={
                "channel": BotConversation.Channels.WEBSITE,
                "client": client,
                "assigned_to": manager,
                "priority": BotConversation.Priorities.HIGH,
                "handoff_required": True,
                "handoff_reason": "Клиент просит запись сегодня — нужен ответ менеджера.",
                "unread_count": 2,
                "last_message_at": timezone.now(),
                "last_inbound_at": timezone.now(),
                "metadata_json": {"demo": True},
            },
        )
        if conversation.messages.count() == 0:
            BotMessage.objects.create(conversation=conversation, direction=BotMessage.Directions.INBOUND, sender_type=BotMessage.SenderTypes.CLIENT, text="Здравствуйте! Можно записаться сегодня?")
            BotMessage.objects.create(conversation=conversation, direction=BotMessage.Directions.OUTBOUND, sender_type=BotMessage.SenderTypes.AI, text="Здравствуйте! Сейчас уточню свободное время у администратора.", status=BotMessage.Statuses.SENT, sent_at=timezone.now())
            BotMessage.objects.create(conversation=conversation, direction=BotMessage.Directions.INBOUND, sender_type=BotMessage.SenderTypes.CLIENT, text="Хорошо, жду ответ.")

    def _ensure_ai_action(self, business: Business, owner, manager):
        log, _ = AIToolCallLog.objects.update_or_create(
            business=business,
            tool_name="create_task",
            input_json={"title": "Связаться с необработанными заявками", "priority": Task.Priorities.HIGH, "recommendation": "AI заметил новые обращения и рекомендует назначить ответственного."},
            defaults={"user": owner, "status": AIToolCallLog.Statuses.EXECUTED, "output_json": {"demo": True}},
        )
        task, _ = Task.objects.update_or_create(
            business=business,
            title="Связаться с необработанными заявками",
            defaults={
                "description": "Demo AI action: проверить новые заявки и ответить клиентам до конца дня.",
                "assignee": manager,
                "created_by": owner,
                "priority": Task.Priorities.HIGH,
                "status": Task.Statuses.OPEN,
                "due_at": timezone.now() + timezone.timedelta(hours=4),
                "reminder_at": timezone.now() + timezone.timedelta(hours=2),
            },
        )
        log.output_json = {"task_id": task.id, "assignee_id": manager.id, "demo": True, "calendar_status": "created"}
        log.save(update_fields=["output_json"])
        Notification.objects.get_or_create(
            business=business,
            channel="system",
            category="tasks",
            text="AI создал демо-задачу: связаться с необработанными заявками.",
            defaults={"priority": Notification.Priorities.HIGH, "status": Notification.Statuses.PENDING, "send_at": timezone.now(), "action_url": f"/app/tasks?task={task.id}", "action_label": "Открыть задачу"},
        )

    def _ensure_quick_replies(self, business: Business):
        specs = [
            ("Запись сегодня", "Здравствуйте! Подскажите, пожалуйста, удобное время сегодня — проверим свободные окна.", "sales", 10),
            ("Уточнить услугу", "Какая услуга вас интересует? Я подскажу стоимость и ближайшее время.", "sales", 20),
            ("Передать администратору", "Я передам ваш запрос администратору, он скоро свяжется с вами.", "support", 30),
        ]
        for title, text, category, sort_order in specs:
            QuickReplyTemplate.objects.update_or_create(
                business=business,
                title=title,
                defaults={"text": text, "category": category, "sort_order": sort_order, "is_active": True},
            )
