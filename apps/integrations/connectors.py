import base64
import hashlib
import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.activities.models import ActivityEvent
from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.clients.models import Client
from apps.crm.models import Deal
from apps.integrations.models import BusinessConnector, BusinessEvent, ConnectorCredential, ConnectorSyncRun
from apps.integrations.sanitization import sanitize_config, sanitize_error_text
from apps.leads.models import Lead
from apps.scheduling.models import Appointment


CONNECTOR_PROVIDER_CAPABILITIES = {
    BusinessConnector.Providers.WEBSITE: {
        "capability": BusinessConnector.Capabilities.SALES,
        "auth_type": BusinessConnector.AuthTypes.NONE,
        "label": "Website / Landing forms",
        "description": "Лендинг, форма заявки и сайт-чат уже могут отдавать лиды в CRM Light.",
        "launch_status": "available",
        "cta_label": "Проверить форму",
        "next_step": "Отправьте тестовую заявку с лендинга и проверьте Lead + Client + Notification.",
        "pilot_note": "Безопасно обещать в пилоте как базовый канал заявок.",
        "setup_priority": 10,
        "is_pilot_safe": True,
    },
    BusinessConnector.Providers.WHATSAPP: {
        "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
        "auth_type": BusinessConnector.AuthTypes.QR,
        "label": "WhatsApp",
        "description": "Meta Embedded Signup для подключения WhatsApp Business номера мерчанта без ручных API-настроек.",
        "launch_status": "beta",
        "cta_label": "Подключить WhatsApp",
        "next_step": "Мерчант нажимает «Подключить через Meta», выбирает бизнес и номер, затем проверяет Inbox.",
        "pilot_note": "Production зависит от Meta app/env, webhook HTTPS и App Review/permissions.",
        "setup_priority": 20,
        "is_pilot_safe": True,
    },
    BusinessConnector.Providers.TELEGRAM: {
        "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "label": "Telegram",
        "description": "Telegram bot channel for merchant-owned customer conversations, Inbox and AI handoff.",
        "launch_status": "available",
        "cta_label": "Подключить Telegram",
        "next_step": "Мерчант создает бота в BotFather, вставляет token, ZANI проверяет доступ и подключает webhook.",
        "pilot_note": "Production requires TELEGRAM_ENABLED=True and a public HTTPS backend URL.",
        "setup_priority": 30,
        "is_pilot_safe": True,
    },
    BusinessConnector.Providers.EXCEL_CSV: {
        "capability": BusinessConnector.Capabilities.SALES,
        "auth_type": BusinessConnector.AuthTypes.NONE,
        "label": "Excel / CSV",
        "description": "Самый быстрый способ дать ZANI данные о продажах, товарах, услугах и остатках без тяжёлых интеграций.",
        "launch_status": "available",
        "cta_label": "Загрузить Excel / CSV",
        "next_step": "Загрузите продажи или каталог, чтобы dashboard начал считать выручку без догадок.",
        "pilot_note": "Критичный безопасный источник данных для пилота.",
        "setup_priority": 40,
        "is_pilot_safe": True,
    },
    BusinessConnector.Providers.INSTAGRAM: {
        "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
        "auth_type": BusinessConnector.AuthTypes.OAUTH,
        "label": "Instagram",
        "description": "Meta OAuth для Instagram Direct: входящие сообщения, Inbox и handoff оператору.",
        "launch_status": "beta",
        "cta_label": "Подключить Instagram",
        "next_step": "Мерчант нажимает «Подключить через Meta», выбирает страницу с Instagram Business account и проверяет Inbox.",
        "pilot_note": "Production требует Meta permissions/review для Instagram messaging.",
        "setup_priority": 50,
        "is_pilot_safe": True,
    },
    BusinessConnector.Providers.GOOGLE_SHEETS: {
        "capability": BusinessConnector.Capabilities.SALES,
        "auth_type": BusinessConnector.AuthTypes.OAUTH,
        "label": "Google Sheets",
        "description": "Удобный следующий шаг после Excel/CSV для регулярной выгрузки данных.",
        "launch_status": "soon",
        "cta_label": "Подключить позже",
        "next_step": "На пилоте используйте Excel/CSV; Google Sheets подключайте после стабилизации.",
        "pilot_note": "Roadmap после пилота.",
        "setup_priority": 60,
        "is_pilot_safe": False,
    },
    BusinessConnector.Providers.ONE_C: {
        "capability": BusinessConnector.Capabilities.INVENTORY,
        "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
        "label": "1C export/import",
        "description": "На старте — через выгрузку/импорт, без обещания realtime-интеграции.",
        "launch_status": "request",
        "cta_label": "Запросить подключение",
        "next_step": "Попросите файл выгрузки или настройте пилотную схему по заявке.",
        "pilot_note": "Не обещать прямую realtime 1C-интеграцию.",
        "setup_priority": 70,
        "is_pilot_safe": False,
    },
    BusinessConnector.Providers.MOYSKLAD: {
        "capability": BusinessConnector.Capabilities.INVENTORY,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "label": "МойСклад",
        "description": "Read-only импорт каталога, остатков, продаж и контрагентов из МойСклад. Сейчас через ключ доступа, далее через app install.",
        "launch_status": "beta",
        "cta_label": "Подключить МойСклад",
        "next_step": "Мерчант вводит ключ доступа как временный self-service baseline; позже заменяем на авторизацию приложения.",
        "pilot_note": "Без обратной записи, изменения остатков и документов в МойСклад.",
        "setup_priority": 80,
        "is_pilot_safe": True,
    },
    BusinessConnector.Providers.KASPI: {
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "label": "Kaspi",
        "description": "Read-only импорт заказов и безопасный pricing agent с порогом минимальной цены.",
        "launch_status": "beta",
        "cta_label": "Подключить Kaspi",
        "next_step": "Мерчант вводит ключ доступа продавца Kaspi, загружает заказы и включает рекомендации цен с минимальным порогом.",
        "pilot_note": "Write-back цен отключен по умолчанию; сначала рекомендации и approval.",
        "setup_priority": 90,
        "is_pilot_safe": True,
    },
    BusinessConnector.Providers.WILDBERRIES: {
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "label": "Wildberries",
        "description": "Read-only импорт заказов, продаж и остатков Wildberries через статистический токен продавца.",
        "launch_status": "beta",
        "cta_label": "Подключить Wildberries",
        "next_step": "Мерчант вводит токен категории Statistics; ZANI проверяет доступ и загружает marketplace события.",
        "pilot_note": "Без изменения цен, поставок, карточек и заказов. Остатки держим опционально из-за изменения WB endpoints.",
        "setup_priority": 100,
        "is_pilot_safe": True,
    },
    BusinessConnector.Providers.OZON: {
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "label": "Ozon",
        "description": "Read-only импорт FBS/FBO отправлений и остатков Ozon через Client-Id и API key продавца.",
        "launch_status": "beta",
        "cta_label": "Подключить Ozon",
        "next_step": "Мерчант вводит Client-Id и API key из кабинета Ozon Seller; ZANI проверяет доступ и загружает marketplace события.",
        "pilot_note": "Без обновления цен, остатков, карточек, сборки и отмены заказов.",
        "setup_priority": 110,
        "is_pilot_safe": True,
    },
    BusinessConnector.Providers.YANDEX_MARKET: {
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
        "label": "Яндекс.Маркет",
        "description": "Marketplace visibility roadmap для рынка РФ.",
        "launch_status": "roadmap",
        "cta_label": "Скоро",
        "next_step": "Собирать интерес и готовить provider после пилота.",
        "pilot_note": "Roadmap.",
        "setup_priority": 120,
        "is_pilot_safe": False,
    },
    BusinessConnector.Providers.EMAIL: {
        "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
        "auth_type": BusinessConnector.AuthTypes.LOGIN,
        "label": "Email",
        "description": "Email можно использовать как дополнительный канал уведомлений после базовой настройки.",
        "launch_status": "soon",
        "cta_label": "Подключить позже",
        "next_step": "Не блокирует пилот.",
        "pilot_note": "Не основной канал для первого запуска.",
        "setup_priority": 130,
        "is_pilot_safe": False,
    },
    BusinessConnector.Providers.GOOGLE_CALENDAR: {
        "capability": BusinessConnector.Capabilities.CALENDAR,
        "auth_type": BusinessConnector.AuthTypes.OAUTH,
        "label": "Google Calendar",
        "description": "Календарь — полезное расширение после CRM Light и задач.",
        "launch_status": "soon",
        "cta_label": "Подключить позже",
        "next_step": "Записи и задачи уже живут в ZANI; Google Calendar подключается позже.",
        "pilot_note": "Roadmap.",
        "setup_priority": 140,
        "is_pilot_safe": False,
    },
    BusinessConnector.Providers.CUSTOM: {
        "capability": BusinessConnector.Capabilities.CUSTOM,
        "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
        "label": "Custom connector",
        "description": "Ручной коннектор для партнёрских/нишевых систем после пилота.",
        "launch_status": "request",
        "cta_label": "Запросить подключение",
        "next_step": "Использовать только по заявке.",
        "pilot_note": "Не массовый пилотный сценарий.",
        "setup_priority": 999,
        "is_pilot_safe": False,
    },
}


CONNECTOR_AVAILABILITY_DEFAULTS = {
    BusinessConnector.Providers.WEBSITE: {"availability": "included", "required_plan": "basic", "setup_state": "active", "action_behavior": "self_service", "primary_action_label": "Настроить сайт-чат"},
    BusinessConnector.Providers.EXCEL_CSV: {"availability": "included", "required_plan": "basic", "setup_state": "active", "action_behavior": "self_service", "primary_action_label": "Загрузить файл"},
    BusinessConnector.Providers.TELEGRAM: {"availability": "included", "required_plan": "business", "setup_state": "setup_required", "action_behavior": "self_service", "primary_action_label": "Подключить Telegram"},
    BusinessConnector.Providers.WHATSAPP: {"availability": "included", "required_plan": "business", "setup_state": "setup_required", "action_behavior": "self_service", "primary_action_label": "Подключить через Meta"},
    BusinessConnector.Providers.INSTAGRAM: {"availability": "included", "required_plan": "pro", "setup_state": "setup_required", "action_behavior": "self_service", "primary_action_label": "Открыть beta-настройку"},
    BusinessConnector.Providers.GOOGLE_SHEETS: {"availability": "upgrade", "required_plan": "business", "setup_state": "coming_soon", "action_behavior": "disabled", "primary_action_label": "В тарифе выше"},
    BusinessConnector.Providers.ONE_C: {"availability": "request", "required_plan": "pro", "setup_state": "request_required", "action_behavior": "request", "primary_action_label": "Запросить подключение"},
    BusinessConnector.Providers.MOYSKLAD: {"availability": "included", "required_plan": "pro", "setup_state": "setup_required", "action_behavior": "self_service", "primary_action_label": "Открыть beta-настройку"},
    BusinessConnector.Providers.KASPI: {"availability": "included", "required_plan": "pro", "setup_state": "setup_required", "action_behavior": "self_service", "primary_action_label": "Открыть beta-настройку"},
    BusinessConnector.Providers.WILDBERRIES: {"availability": "included", "required_plan": "pro", "setup_state": "setup_required", "action_behavior": "self_service", "primary_action_label": "Открыть beta-настройку"},
    BusinessConnector.Providers.OZON: {"availability": "included", "required_plan": "pro", "setup_state": "setup_required", "action_behavior": "self_service", "primary_action_label": "Открыть beta-настройку"},
    BusinessConnector.Providers.YANDEX_MARKET: {"availability": "roadmap", "required_plan": "pro", "setup_state": "roadmap", "action_behavior": "disabled", "primary_action_label": "Скоро"},
    BusinessConnector.Providers.EMAIL: {"availability": "upgrade", "required_plan": "business", "setup_state": "coming_soon", "action_behavior": "disabled", "primary_action_label": "В тарифе выше"},
    BusinessConnector.Providers.GOOGLE_CALENDAR: {"availability": "upgrade", "required_plan": "business", "setup_state": "coming_soon", "action_behavior": "disabled", "primary_action_label": "В тарифе выше"},
    BusinessConnector.Providers.CUSTOM: {"availability": "request", "required_plan": "pro", "setup_state": "request_required", "action_behavior": "request", "primary_action_label": "Запросить подключение"},
}


def available_connector_capabilities():
    return [
        {
            "provider": provider,
            "label": config["label"],
            "capability": config["capability"],
            "auth_type": config["auth_type"],
            "description": config.get("description", ""),
            "launch_status": config.get("launch_status", "soon"),
            "cta_label": config.get("cta_label", "Подключить"),
            "next_step": config.get("next_step", ""),
            "pilot_note": config.get("pilot_note", ""),
            "setup_priority": config.get("setup_priority", 999),
            "is_pilot_safe": config.get("is_pilot_safe", False),
            **CONNECTOR_AVAILABILITY_DEFAULTS.get(provider, {
                "availability": "request",
                "required_plan": "pro",
                "setup_state": "request_required",
                "action_behavior": "request",
                "primary_action_label": config.get("cta_label", "Запросить подключение"),
            }),
        }
        for provider, config in sorted(
            CONNECTOR_PROVIDER_CAPABILITIES.items(),
            key=lambda item: item[1].get("setup_priority", 999),
        )
    ]


def defaults_for_provider(provider):
    return CONNECTOR_PROVIDER_CAPABILITIES.get(
        provider,
        {
            "capability": BusinessConnector.Capabilities.CUSTOM,
            "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
            "label": provider.replace("_", " ").title(),
        },
    )


def mask_secret(value):
    value = str(value or "")
    if not value:
        return ""
    if len(value) <= 8:
        return f"{value[:2]}***{value[-2:]}"
    return f"{value[:4]}...{value[-4:]}"


def _credential_key_stream(salt, length):
    seed = f"{settings.SECRET_KEY}:{salt}:connector-credential".encode("utf-8")
    output = b""
    counter = 0
    while len(output) < length:
        output += hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        counter += 1
    return output[:length]


def encrypt_credential_value(raw_value):
    plaintext = str(raw_value).encode("utf-8")
    salt = secrets.token_hex(16)
    stream = _credential_key_stream(salt, len(plaintext))
    ciphertext = bytes(left ^ right for left, right in zip(plaintext, stream))
    envelope = {
        "v": 1,
        "salt": salt,
        "ciphertext": base64.urlsafe_b64encode(ciphertext).decode("ascii"),
    }
    return signing.dumps(envelope, salt="zani.connector-credential")


def decrypt_credential_value(encrypted_value):
    envelope = signing.loads(encrypted_value, salt="zani.connector-credential")
    ciphertext = base64.urlsafe_b64decode(envelope["ciphertext"].encode("ascii"))
    stream = _credential_key_stream(envelope["salt"], len(ciphertext))
    plaintext = bytes(left ^ right for left, right in zip(ciphertext, stream))
    return plaintext.decode("utf-8")


def create_or_update_credential(connector, key, raw_value, expires_at=None):
    encrypted_value = encrypt_credential_value(raw_value)
    defaults = {
        "business": connector.business,
        "encrypted_value": encrypted_value,
        "masked_value": mask_secret(raw_value),
        "expires_at": expires_at,
        "rotated_at": timezone.now(),
    }
    credential, _ = ConnectorCredential.objects.update_or_create(
        connector=connector,
        key=key,
        defaults=defaults,
    )
    return credential


def connector_has_active_credentials(connector):
    if connector.provider == BusinessConnector.Providers.TELEGRAM:
        config = connector.config_json or {}
        bot_channel_id = config.get("bot_channel_id")
        if bot_channel_id:
            from apps.bots.models import BotChannel

            return BotChannel.objects.filter(
                id=bot_channel_id,
                channel=BotChannel.Channels.TELEGRAM,
            ).exclude(config_json__bot_token="").exists()
        return bool(config.get("token_configured"))
    if connector.provider == BusinessConnector.Providers.WHATSAPP:
        config = connector.config_json or {}
        bot_channel_id = config.get("bot_channel_id")
        if bot_channel_id:
            from apps.bots.models import BotChannel

            return BotChannel.objects.filter(
                id=bot_channel_id,
                channel=BotChannel.Channels.WHATSAPP,
            ).exclude(config_json__access_token="").exclude(config_json__phone_number_id="").exists()
        return bool(config.get("access_token_configured") and config.get("phone_number_id_configured"))
    if connector.provider == BusinessConnector.Providers.INSTAGRAM:
        config = connector.config_json or {}
        bot_channel_id = config.get("bot_channel_id")
        if bot_channel_id:
            from apps.bots.models import BotChannel

            return BotChannel.objects.filter(
                id=bot_channel_id,
                channel=BotChannel.Channels.INSTAGRAM,
            ).exclude(config_json__access_token="").exclude(config_json__instagram_user_id="").exists()
        return bool(config.get("access_token_configured") and config.get("instagram_user_id_configured"))

    now = timezone.now()
    return connector.credentials.filter(expires_at__isnull=True).exists() or connector.credentials.filter(expires_at__gt=now).exists()


def update_connector_health(connector, status=None, error="", save=True):
    if status is None:
        status = BusinessConnector.Statuses.CONNECTED if connector_has_active_credentials(connector) or connector.auth_type == BusinessConnector.AuthTypes.NONE else BusinessConnector.Statuses.NEEDS_ATTENTION
    connector.status = status
    connector.last_error = sanitize_error_text(error)
    if status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    if save:
        connector.save(update_fields=["status", "last_error", "connected_at", "updated_at"])
    return connector


def business_event_deduplication_key(source, event_type, payload, external_id=""):
    if external_id:
        raw = f"{source}:{event_type}:{external_id}"
    else:
        serialized = json.dumps(payload or {}, sort_keys=True, default=str)
        raw = f"{source}:{event_type}:{serialized}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def normalize_business_event(business, source, event_type, payload, external_id="", connector=None, occurred_at=None):
    deduplication_key = business_event_deduplication_key(source, event_type, payload, external_id=external_id)
    safe_payload = sanitize_config(payload or {})
    defaults = {
        "connector": connector,
        "event_type": event_type,
        "external_id": external_id or "",
        "occurred_at": occurred_at or timezone.now(),
        "payload_json": safe_payload,
        "status": BusinessEvent.Statuses.RECEIVED,
    }
    try:
        with transaction.atomic():
            event, created = BusinessEvent.objects.get_or_create(
                business=business,
                source=source,
                deduplication_key=deduplication_key,
                defaults=defaults,
            )
    except IntegrityError:
        event = BusinessEvent.objects.get(
            business=business,
            source=source,
            deduplication_key=deduplication_key,
        )
        created = False
    if created:
        create_timeline_event_for_business_event(event)
    return event, created


def create_timeline_event_for_business_event(event):
    resolved = _crm_timeline_target_for_event(event)
    if resolved is None:
        return None

    client, target_type, target_id = resolved
    metadata = {
        "event_type": ActivityEvents.INTEGRATION_EVENT,
        "business_event_id": event.id,
        "integration_event_type": event.event_type,
        "source": event.source,
        "connector_id": event.connector_id,
        "external_id": event.external_id,
        "target_type": target_type,
        "target_id": target_id,
    }
    return create_activity_event(
        business=event.business,
        client=client,
        instance=event,
        category=ActivityEvent.Categories.SYSTEM,
        source=event.source,
        event_type=ActivityEvents.INTEGRATION_EVENT,
        text=f"Integration event: {event.source}.{event.event_type}",
        metadata=metadata,
    )


def _crm_timeline_target_for_event(event):
    payload = event.payload_json or {}
    if not isinstance(payload, dict):
        return None

    client = _resolve_client(event.business, payload.get("client_id"))
    if client is not None:
        return client, "Client", client.id

    lead = _resolve_lead(event.business, payload.get("lead_id"))
    if lead is not None:
        return lead.client, "Lead", lead.id

    deal = _resolve_deal(event.business, payload.get("deal_id"))
    if deal is not None:
        return deal.client, "Deal", deal.id

    appointment = _resolve_appointment(event.business, payload.get("appointment_id"))
    if appointment is not None:
        return appointment.client, "Appointment", appointment.id

    return None


def _resolve_client(business, value):
    object_id = _safe_positive_int(value)
    if object_id is None:
        return None
    return Client.objects.filter(business=business, id=object_id).first()


def _resolve_lead(business, value):
    object_id = _safe_positive_int(value)
    if object_id is None:
        return None
    return Lead.objects.select_related("client").filter(business=business, id=object_id).first()


def _resolve_deal(business, value):
    object_id = _safe_positive_int(value)
    if object_id is None:
        return None
    return Deal.objects.select_related("client").filter(business=business, id=object_id).first()


def _resolve_appointment(business, value):
    object_id = _safe_positive_int(value)
    if object_id is None:
        return None
    return Appointment.objects.select_related("client").filter(business=business, id=object_id).first()


def _safe_positive_int(value):
    if value in (None, ""):
        return None
    try:
        object_id = int(value)
    except (TypeError, ValueError):
        return None
    return object_id if object_id > 0 else None


def run_connector_healthcheck(connector):
    now = timezone.now()
    run = ConnectorSyncRun.objects.create(
        business=connector.business,
        connector=connector,
        mode=ConnectorSyncRun.Modes.HEALTHCHECK,
        status=ConnectorSyncRun.Statuses.RUNNING,
        started_at=now,
    )
    status = BusinessConnector.Statuses.CONNECTED
    error = ""
    if connector.status == BusinessConnector.Statuses.DISABLED:
        status = BusinessConnector.Statuses.DISABLED
    elif connector.provider == BusinessConnector.Providers.TELEGRAM and not settings.TELEGRAM_ENABLED:
        status = BusinessConnector.Statuses.FAILED
        error = "Telegram integration is disabled."
    elif connector.auth_type != BusinessConnector.AuthTypes.NONE and not connector_has_active_credentials(connector):
        status = BusinessConnector.Statuses.NEEDS_ATTENTION
        error = "Connector credentials are missing or expired."
    update_connector_health(connector, status=status, error=error)
    run.status = ConnectorSyncRun.Statuses.SUCCEEDED if not error else ConnectorSyncRun.Statuses.FAILED
    run.error = sanitize_error_text(error)
    run.finished_at = timezone.now()
    run.events_received = 0
    run.events_processed = 0
    run.save(update_fields=["status", "error", "finished_at", "events_received", "events_processed"])
    connector.next_sync_at = timezone.now() + timedelta(hours=6)
    connector.last_sync_at = run.finished_at
    connector.save(update_fields=["last_sync_at", "next_sync_at", "updated_at"])
    return run
