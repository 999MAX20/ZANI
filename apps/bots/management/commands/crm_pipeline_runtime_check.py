import json
from datetime import time
from uuid import uuid4

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AIRequestLog
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.notifications.delivery import deliver_notification, handle_appointment_followup_reply
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment, AppointmentMessageSetting, Resource, WorkingHours
from apps.services.models import Service


class Command(BaseCommand):
    help = "Run a safe local CRM sales pipeline check: website chat -> AI pipeline -> appointment -> notification -> confirmation reply."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
        parser.add_argument("--allow-live-ai", action="store_true", help="Use configured live AI provider instead of forcing mock AI.")
        parser.add_argument("--fail-on-missing-live", action="store_true", help="Fail when live AI or external messaging providers are not configured.")
        parser.add_argument("--keep-data", action="store_true", help="Keep generated smoke data instead of marking it archived/closed where supported.")

    def handle(self, *args, **options):
        report = {
            "check": "crm_pipeline_runtime_check",
            "environment": settings.ENVIRONMENT,
            "provider_readiness": self._provider_readiness(options),
            "steps": [],
            "ok": False,
        }

        if options["fail_on_missing_live"] and not report["provider_readiness"]["ready_for_live_external"]:
            raise CommandError(json.dumps(report, ensure_ascii=False, indent=2))

        runner = override_settings(ALLOWED_HOSTS=list(getattr(settings, "ALLOWED_HOSTS", [])) + ["testserver"])(self._run_scenario)
        if not options["allow_live_ai"]:
            runner = override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")(runner)

        try:
            scenario = runner(keep_data=options["keep_data"])
        except Exception as exc:
            report["error"] = str(exc)
            if options["json"]:
                self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
                return
            raise CommandError(str(exc)) from exc

        report.update(scenario)
        report["ok"] = all(step["status"] == "pass" for step in report["steps"])

        if options["json"]:
            self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
            return

        self.stdout.write("Zani CRM pipeline runtime check")
        self.stdout.write(f"AI mode used: {report['ai_mode_used']}")
        self.stdout.write(f"Live external ready: {report['provider_readiness']['ready_for_live_external']}")
        for step in report["steps"]:
            style = self.style.SUCCESS if step["status"] == "pass" else self.style.ERROR
            self.stdout.write(style(f"{step['status'].upper()}: {step['name']} - {step['detail']}"))
        self.stdout.write(self.style.SUCCESS("CRM pipeline runtime check passed." if report["ok"] else "CRM pipeline runtime check failed."))

        if not report["ok"]:
            raise CommandError("CRM pipeline runtime check failed.")

    def _provider_readiness(self, options):
        ai_key_ready = {
            "openrouter": bool(getattr(settings, "OPENROUTER_API_KEY", "")),
            "openai": bool(getattr(settings, "OPENAI_API_KEY", "")),
            "kimi": bool(getattr(settings, "KIMI_API_KEY", "")),
            "mock": True,
        }.get(getattr(settings, "AI_PROVIDER", "mock"), False)
        telegram_ready = bool(getattr(settings, "TELEGRAM_ENABLED", False))
        whatsapp_ready = bool(getattr(settings, "WHATSAPP_ENABLED", False))
        return {
            "configured_ai_provider": getattr(settings, "AI_PROVIDER", "mock"),
            "ai_key_ready": ai_key_ready,
            "ai_live_allowed_for_this_run": bool(options["allow_live_ai"]),
            "telegram_enabled": telegram_ready,
            "whatsapp_enabled": whatsapp_ready,
            "ready_for_safe_local_check": True,
            "ready_for_live_external": ai_key_ready and (telegram_ready or whatsapp_ready),
            "note": "Safe local check uses website chat and system notifications. Live external mode additionally needs AI key and Telegram or WhatsApp provider.",
        }

    def _run_scenario(self, *, keep_data):
        suffix = uuid4().hex[:10]
        owner = User.objects.create_user(
            username=f"crm-smoke-owner-{suffix}",
            email=f"crm-smoke-owner-{suffix}@example.com",
            password=uuid4().hex,
            role=User.Roles.BUSINESS_OWNER,
        )
        business = Business.objects.create(
            owner=owner,
            name=f"CRM Pipeline Smoke {suffix}",
            slug=f"crm-pipeline-smoke-{suffix}",
            business_type=Business.BusinessTypes.BEAUTY,
            city="Almaty",
            timezone="Asia/Almaty",
            status=Business.Statuses.ACTIVE,
        )
        BusinessMember.objects.create(business=business, user=owner, role=BusinessMember.Roles.OWNER)
        service = Service.objects.create(business=business, name="Консультация", duration_minutes=60, price_from=12000)
        resource = Resource.objects.create(business=business, name="Мастер Алия", resource_type=Resource.ResourceTypes.STAFF)
        slot_date = timezone.localdate() + timezone.timedelta(days=1)
        WorkingHours.objects.create(
            business=business,
            resource=resource,
            weekday=slot_date.weekday(),
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        self._create_message_settings(business)
        bot = Bot.objects.create(business=business, name="CRM Runtime Sales Bot", status=Bot.Statuses.ACTIVE)
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

        api = APIClient()
        steps = []
        first = api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/",
            {
                "full_name": "Runtime Client",
                "phone": "+77015550999",
                "message": "Хочу записаться на консультацию к Мастер Алия",
                "external_user_id": f"runtime-{suffix}",
            },
            format="json",
        )
        steps.append(self._step("website chat creates conversation", first.status_code == 201, f"status={first.status_code}"))
        conversation = BotConversation.objects.get(public_id=first.data["conversation_id"])
        offered_slots = ((conversation.metadata_json or {}).get("auto_booking") or {}).get("offered_slots") or []
        steps.append(self._step("AI pipeline offered real slots", bool(offered_slots), f"slots={len(offered_slots)}"))

        second = api.post(
            f"/api/public/website-chat/{channel.public_token}/conversations/{conversation.public_id}/messages/",
            {"message": "Первый вариант подходит"},
            format="json",
        )
        steps.append(self._step("client selected slot", second.status_code == 201, f"status={second.status_code}"))
        conversation.refresh_from_db()
        appointment = Appointment.objects.filter(business=business, client=conversation.client, lead=conversation.lead).first()
        steps.append(self._step("appointment created", appointment is not None, f"appointment_id={appointment.id if appointment else None}"))

        confirmation = Notification.objects.filter(appointment=appointment, action_label="Подтвердить запись").first() if appointment else None
        reminder = Notification.objects.filter(appointment=appointment, action_label="Напомнить о записи").first() if appointment else None
        steps.append(self._step("auto confirmation/reminder queued", bool(confirmation and reminder), f"confirmation={bool(confirmation)} reminder={bool(reminder)}"))

        if confirmation:
            confirmation.send_at = timezone.now() - timezone.timedelta(minutes=1)
            confirmation.save(update_fields=["send_at", "updated_at"])
            delivery_result = deliver_notification(confirmation)
            confirmation.refresh_from_db()
            delivered = confirmation.status == Notification.Statuses.SENT
        else:
            delivery_result = {}
            delivered = False
        steps.append(self._step("due notification delivered", delivered, f"result={delivery_result}"))

        if conversation.client_id:
            Client.objects.filter(id=conversation.client_id).update(telegram_id=f"runtime-tg-{suffix}")
        reply_result = handle_appointment_followup_reply(
            business=business,
            channel=Notification.Channels.TELEGRAM,
            external_user_id=f"runtime-tg-{suffix}",
            text="Да",
        )
        if appointment:
            appointment.refresh_from_db()
        confirmed = bool(appointment and appointment.status == Appointment.Statuses.CONFIRMED and reply_result.get("status") == "confirmed")
        steps.append(self._step("client reply confirms appointment", confirmed, f"reply={reply_result}"))

        outbound_count = BotMessage.objects.filter(conversation=conversation, direction=BotMessage.Directions.OUTBOUND).count()
        steps.append(self._step("bot wrote outbound confirmation", outbound_count > 0, f"outbound_messages={outbound_count}"))
        ai_logs = self._ai_log_summary(business)
        live_ai_used = any(item["provider"] != "mock" for item in ai_logs)
        steps.append(
            self._step(
                "AI calls recorded",
                bool(ai_logs),
                f"logs={len(ai_logs)} live_provider_used={live_ai_used}",
            )
        )

        if not keep_data:
            conversation.status = BotConversation.Statuses.ARCHIVED
            conversation.is_archived = True
            conversation.archived_at = timezone.now()
            conversation.archive_reason = "crm_pipeline_runtime_check cleanup marker"
            conversation.save(update_fields=["status", "is_archived", "archived_at", "archive_reason", "updated_at"])

        return {
            "ai_mode_used": getattr(settings, "AI_PROVIDER", "mock"),
            "business_id": business.id,
            "conversation_id": conversation.id,
            "appointment_id": appointment.id if appointment else None,
            "ai_logs": ai_logs,
            "steps": steps,
        }

    def _create_message_settings(self, business):
        AppointmentMessageSetting.objects.create(
            business=business,
            scenario=AppointmentMessageSetting.Scenarios.CONFIRMATION,
            label="Подтвердить запись",
            is_enabled=True,
            offset_minutes=-180,
            channel_policy=AppointmentMessageSetting.ChannelPolicies.SYSTEM,
            template_text="Runtime check: {client_name}, подтвердите {service_name}{resource_text} {date} в {time}.",
        )
        AppointmentMessageSetting.objects.create(
            business=business,
            scenario=AppointmentMessageSetting.Scenarios.REMINDER,
            label="Напомнить о записи",
            is_enabled=True,
            offset_minutes=-60,
            channel_policy=AppointmentMessageSetting.ChannelPolicies.SYSTEM,
            template_text="Runtime reminder: {service_name} в {time}.",
        )

    def _step(self, name, passed, detail):
        return {"name": name, "status": "pass" if passed else "fail", "detail": detail}

    def _ai_log_summary(self, business):
        logs = AIRequestLog.objects.filter(business=business).order_by("created_at")
        return [
            {
                "id": log.id,
                "prompt_type": log.prompt_type,
                "provider": (log.input_json or {}).get("ai_provider", ""),
                "model": log.model,
                "tokens_used": log.tokens_used,
                "is_mock": (log.input_json or {}).get("ai_provider", "") == "mock",
            }
            for log in logs
        ]
