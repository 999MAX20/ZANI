from __future__ import annotations

from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai_core.models import AgentProfile, BusinessKnowledgeItem
from apps.billing.models import Subscription
from apps.bots.models import Bot, BotChannel, BotConversation
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import ImportJob
from apps.crm.models import Deal
from apps.integrations.models import BusinessConnector
from apps.leads.models import Lead, LeadForm
from apps.scheduling.models import Appointment, Resource, WorkingHours
from apps.services.models import Service
from apps.tasks.models import Task


class PilotReadinessView(APIView):
    """Return a compact readiness checklist for the current merchant workspace.

    The endpoint is intentionally read-only and does not create or mutate demo data.
    It is used by the pilot QA UI to show whether the current business is ready
    for a clickable pilot/demo run.
    """

    permission_classes = [IsAuthenticated]

    def get_business(self, request):
        business_id = request.query_params.get("business") or request.headers.get("X-Business-ID")
        memberships = BusinessMember.objects.select_related("business").filter(user=request.user, is_active=True)
        if business_id:
            return memberships.filter(business_id=business_id).first().business if memberships.filter(business_id=business_id).exists() else None
        membership = memberships.order_by("business__name").first()
        return membership.business if membership else None

    def item(self, key, title, description, is_ready, *, count=None, status=None, href=""):
        if status is None:
            status = "ready" if is_ready else "missing"
        return {
            "key": key,
            "title": title,
            "description": description,
            "is_ready": bool(is_ready),
            "status": status,
            "count": count,
            "href": href,
        }

    def get(self, request):
        business = self.get_business(request)
        if not business:
            return Response(
                {
                    "business": None,
                    "score": 0,
                    "ready_count": 0,
                    "total_count": 0,
                    "critical_missing": ["business"],
                    "items": [],
                    "next_actions": [
                        "Создайте или выберите бизнес, чтобы проверить готовность пилота.",
                    ],
                }
            )

        members = BusinessMember.objects.filter(business=business, is_active=True)
        owners = members.filter(role=BusinessMember.Roles.OWNER)
        managers = members.exclude(role=BusinessMember.Roles.OWNER)
        clients = Client.objects.filter(business=business, is_archived=False)
        leads = Lead.objects.filter(business=business, is_archived=False)
        deals = Deal.objects.filter(business=business, is_archived=False)
        tasks = Task.objects.filter(business=business, is_archived=False)
        appointments = Appointment.objects.filter(business=business, is_archived=False)
        services = Service.objects.filter(business=business, is_active=True)
        resources = Resource.objects.filter(business=business, is_active=True)
        bots = Bot.objects.filter(business=business)
        active_bots = bots.filter(status=Bot.Statuses.ACTIVE)
        website_channels = BotChannel.objects.filter(bot__business=business, channel=BotChannel.Channels.WEBSITE)
        active_website_channels = website_channels.filter(status=BotChannel.Statuses.ACTIVE)
        inbox_conversations = BotConversation.objects.filter(business=business)
        open_inbox = inbox_conversations.filter(status=BotConversation.Statuses.OPEN)
        lead_forms = LeadForm.objects.filter(business=business, is_active=True)
        connectors = BusinessConnector.objects.filter(business=business)
        connected_connectors = connectors.filter(status=BusinessConnector.Statuses.CONNECTED)
        import_jobs = ImportJob.objects.filter(business=business)
        ai_ready = (
            BusinessKnowledgeItem.objects.filter(business=business, is_active=True).exists()
            or AgentProfile.objects.filter(business=business, is_active=True).exists()
        )
        subscription = getattr(business, "subscription", None)

        checklist = [
            self.item(
                "crm_configured",
                "CRM настроена",
                "Есть базовая структура CRM: услуги, ресурсы, график и воронка.",
                business.services.exists() and business.resources.exists() and business.working_hours.exists() and business.pipelines.exists(),
                status="ready" if business.services.exists() and business.resources.exists() and business.working_hours.exists() and business.pipelines.exists() else "needs_attention",
                href="/dashboard/onboarding",
            ),
            self.item(
                "business_profile",
                "Профиль бизнеса создан",
                "Название, город и базовые контакты бизнеса есть в системе.",
                bool(business.name and business.city),
                status="ready" if business.name and business.city else "needs_attention",
                href="/dashboard/settings",
            ),
            self.item(
                "business_owner",
                "Владелец бизнеса создан",
                "Есть активный owner, который может управлять кабинетом.",
                owners.exists(),
                count=owners.count(),
                href="/dashboard/settings",
            ),
            self.item(
                "manager",
                "Менеджер или сотрудник создан",
                "Есть минимум один сотрудник для проверки ролей и операционной работы.",
                managers.exists(),
                count=managers.count(),
                href="/dashboard/settings",
            ),
            self.item(
                "clients",
                "Клиенты есть",
                "В CRM есть тестовая клиентская база.",
                clients.exists(),
                count=clients.count(),
                href="/dashboard/clients",
            ),
            self.item(
                "leads",
                "Первая заявка есть",
                "В CRM есть тестовая заявка для проверки обработки входящего лида.",
                leads.exists(),
                count=leads.count(),
                href="/dashboard/leads",
            ),
            self.item(
                "deals",
                "Первая сделка есть",
                "Воронка продаж содержит тестовую сделку и готова к пилотному сценарию.",
                deals.exists(),
                count=deals.count(),
                href="/dashboard/deals",
            ),
            self.item(
                "tasks",
                "Первая задача есть",
                "Есть follow-up задача для менеджера или оператора.",
                tasks.exists(),
                count=tasks.count(),
                href="/dashboard/tasks",
            ),
            self.item(
                "appointments",
                "Записи есть",
                "Календарь содержит тестовые записи.",
                appointments.exists(),
                count=appointments.count(),
                href="/dashboard/calendar",
            ),
            self.item(
                "services",
                "Услуги настроены",
                "Добавлены услуги, которые можно использовать в заявках и записях.",
                services.exists(),
                count=services.count(),
                href="/dashboard/services",
            ),
            self.item(
                "resources",
                "Ресурсы настроены",
                "Есть сотрудники/кабинеты/ресурсы для расписания.",
                resources.exists(),
                count=resources.count(),
                href="/dashboard/resources",
            ),
            self.item(
                "working_hours",
                "Рабочие часы настроены",
                "График работы нужен для корректных свободных слотов и записей.",
                WorkingHours.objects.filter(business=business).exists(),
                count=WorkingHours.objects.filter(business=business).count(),
                href="/dashboard/working-hours",
            ),
            self.item(
                "bot",
                "Бот создан",
                "Есть активный или черновой бот для каналов связи.",
                bots.exists(),
                count=bots.count(),
                status="ready" if active_bots.exists() else ("needs_attention" if bots.exists() else "missing"),
                href="/dashboard/bots",
            ),
            self.item(
                "website_channel",
                "Website channel активен",
                "Есть публичный website chat канал для приема обращений.",
                active_website_channels.exists(),
                count=active_website_channels.count() or website_channels.count(),
                status="ready" if active_website_channels.exists() else ("needs_attention" if website_channels.exists() else "missing"),
                href="/dashboard/bots",
            ),
            self.item(
                "lead_form",
                "Публичная форма заявок активна",
                "Есть active lead form для лендинга/сайта.",
                lead_forms.exists(),
                count=lead_forms.count(),
                href="/dashboard/settings",
            ),
            self.item(
                "inbox",
                "Inbox содержит тестовый диалог",
                "Есть диалог, который можно проверить в едином центре сообщений.",
                inbox_conversations.exists(),
                count=inbox_conversations.count(),
                status="ready" if open_inbox.exists() else ("needs_attention" if inbox_conversations.exists() else "missing"),
                href="/dashboard/inbox",
            ),
            self.item(
                "billing",
                "Тариф или подписка активны",
                "Бизнес привязан к плану для проверки SaaS-логики.",
                bool(subscription and subscription.plan_id),
                status="ready" if subscription and subscription.status in {Subscription.Statuses.TRIAL, Subscription.Statuses.ACTIVE} else ("needs_attention" if subscription else "missing"),
                href="/dashboard/billing",
            ),
            self.item(
                "ai_assistant",
                "AI Assistant доступен",
                "Есть knowledge base или профиль агента для контролируемых AI-подсказок.",
                ai_ready,
                status="ready" if ai_ready else "needs_attention",
                href="/dashboard/ai-assistant",
            ),
            self.item(
                "integrations_catalog",
                "Каталог интеграций доступен",
                "Коннекторы заведены как управляемые модули подключения.",
                connectors.exists(),
                count=connectors.count(),
                status="ready" if connected_connectors.exists() else ("needs_attention" if connectors.exists() else "missing"),
                href="/dashboard/integrations",
            ),
            self.item(
                "import_jobs",
                "Excel / CSV импорт проверен",
                "Есть история импорта клиентов или заявок, чтобы показать перенос базы без ручной работы.",
                import_jobs.exists(),
                count=import_jobs.count(),
                status="ready" if import_jobs.filter(status=ImportJob.Statuses.IMPORTED).exists() else ("needs_attention" if import_jobs.exists() else "missing"),
                href="/dashboard/settings#data-tools",
            ),
        ]

        ready_count = sum(1 for item in checklist if item["is_ready"])
        total_count = len(checklist)
        score = round((ready_count / total_count) * 100) if total_count else 0
        critical_missing = [item["key"] for item in checklist if not item["is_ready"] and item["key"] in {"business_owner", "clients", "leads", "bot", "website_channel", "inbox"}]
        next_actions = [item["description"] for item in checklist if not item["is_ready"]][:4]

        return Response(
            {
                "business": {
                    "id": business.id,
                    "name": business.name,
                    "slug": business.slug,
                    "status": business.status,
                },
                "score": score,
                "ready_count": ready_count,
                "total_count": total_count,
                "critical_missing": critical_missing,
                "items": checklist,
                "next_actions": next_actions,
            }
        )
