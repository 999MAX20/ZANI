import base64
import hashlib
import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.integrations.models import BusinessConnector, BusinessEvent, ConnectorCredential, ConnectorSyncRun


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
        "description": "На пилоте безопасно начинать с WhatsApp-кнопки и статуса beta для расширенной интеграции.",
        "launch_status": "beta",
        "cta_label": "Подключить WhatsApp",
        "next_step": "Сначала включите кнопку WhatsApp. Полный API подключается отдельно после provider-проверки.",
        "pilot_note": "Не обещать полноценный WhatsApp API как готовый production.",
        "setup_priority": 20,
        "is_pilot_safe": True,
    },
    BusinessConnector.Providers.TELEGRAM: {
        "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "label": "Telegram",
        "description": "Telegram foundation подходит для beta-уведомлений и простого бота.",
        "launch_status": "beta",
        "cta_label": "Подключить Telegram",
        "next_step": "Добавьте bot token или используйте mock/beta режим для тестового контура.",
        "pilot_note": "Можно показывать как beta/foundation.",
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
        "description": "Instagram Direct остаётся в roadmap/beta, пока нет production provider.",
        "launch_status": "soon",
        "cta_label": "Оставить заявку на подключение",
        "next_step": "Покажите статус 'скоро' и собирайте интерес, не обещая production Direct.",
        "pilot_note": "Не продавать как готовую омниканальность.",
        "setup_priority": 50,
        "is_pilot_safe": False,
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
        "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
        "label": "МойСклад",
        "description": "Склад и остатки подключаются по заявке; для пилота используем CSV/Excel fallback.",
        "launch_status": "request",
        "cta_label": "Запросить подключение",
        "next_step": "Сначала загрузите остатки через Excel/CSV, затем подключайте МойСклад по заявке.",
        "pilot_note": "Roadmap/request, не готовый массовый provider.",
        "setup_priority": 80,
        "is_pilot_safe": False,
    },
    BusinessConnector.Providers.KASPI: {
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
        "label": "Kaspi",
        "description": "Marketplace visibility: продажи, цены, остатки и демпинг — будущий платный модуль.",
        "launch_status": "roadmap",
        "cta_label": "Скоро",
        "next_step": "Показывайте как будущий модуль, не как готовую интеграцию.",
        "pilot_note": "Не обещать auto-repricing и realtime Kaspi на пилоте.",
        "setup_priority": 90,
        "is_pilot_safe": False,
    },
    BusinessConnector.Providers.WILDBERRIES: {
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
        "label": "Wildberries",
        "description": "Marketplace visibility roadmap для продаж, SKU, остатков и возвратов.",
        "launch_status": "roadmap",
        "cta_label": "Скоро",
        "next_step": "Собирать интерес и готовить provider после пилота.",
        "pilot_note": "Roadmap.",
        "setup_priority": 100,
        "is_pilot_safe": False,
    },
    BusinessConnector.Providers.OZON: {
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
        "label": "Ozon",
        "description": "Marketplace visibility roadmap для продаж, SKU, остатков и возвратов.",
        "launch_status": "roadmap",
        "cta_label": "Скоро",
        "next_step": "Собирать интерес и готовить provider после пилота.",
        "pilot_note": "Roadmap.",
        "setup_priority": 110,
        "is_pilot_safe": False,
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
    BusinessConnector.Providers.TELEGRAM: {"availability": "included", "required_plan": "business", "setup_state": "setup_required", "action_behavior": "self_service", "primary_action_label": "Открыть beta-настройку"},
    BusinessConnector.Providers.WHATSAPP: {"availability": "request", "required_plan": "business", "setup_state": "request_required", "action_behavior": "request", "primary_action_label": "Запросить подключение"},
    BusinessConnector.Providers.INSTAGRAM: {"availability": "request", "required_plan": "pro", "setup_state": "request_required", "action_behavior": "request", "primary_action_label": "Оставить заявку"},
    BusinessConnector.Providers.GOOGLE_SHEETS: {"availability": "upgrade", "required_plan": "business", "setup_state": "coming_soon", "action_behavior": "disabled", "primary_action_label": "В тарифе выше"},
    BusinessConnector.Providers.ONE_C: {"availability": "request", "required_plan": "pro", "setup_state": "request_required", "action_behavior": "request", "primary_action_label": "Запросить подключение"},
    BusinessConnector.Providers.MOYSKLAD: {"availability": "request", "required_plan": "pro", "setup_state": "request_required", "action_behavior": "request", "primary_action_label": "Запросить подключение"},
    BusinessConnector.Providers.KASPI: {"availability": "roadmap", "required_plan": "pro", "setup_state": "roadmap", "action_behavior": "disabled", "primary_action_label": "Скоро"},
    BusinessConnector.Providers.WILDBERRIES: {"availability": "roadmap", "required_plan": "pro", "setup_state": "roadmap", "action_behavior": "disabled", "primary_action_label": "Скоро"},
    BusinessConnector.Providers.OZON: {"availability": "roadmap", "required_plan": "pro", "setup_state": "roadmap", "action_behavior": "disabled", "primary_action_label": "Скоро"},
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

    now = timezone.now()
    return connector.credentials.filter(expires_at__isnull=True).exists() or connector.credentials.filter(expires_at__gt=now).exists()


def update_connector_health(connector, status=None, error="", save=True):
    if status is None:
        status = BusinessConnector.Statuses.CONNECTED if connector_has_active_credentials(connector) or connector.auth_type == BusinessConnector.AuthTypes.NONE else BusinessConnector.Statuses.NEEDS_ATTENTION
    connector.status = status
    connector.last_error = error
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
    defaults = {
        "connector": connector,
        "event_type": event_type,
        "external_id": external_id or "",
        "occurred_at": occurred_at or timezone.now(),
        "payload_json": payload or {},
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
    return event, created


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
    elif connector.auth_type != BusinessConnector.AuthTypes.NONE and not connector_has_active_credentials(connector):
        status = BusinessConnector.Statuses.NEEDS_ATTENTION
        error = "Connector credentials are missing or expired."
    update_connector_health(connector, status=status, error=error)
    run.status = ConnectorSyncRun.Statuses.SUCCEEDED if not error else ConnectorSyncRun.Statuses.FAILED
    run.error = error
    run.finished_at = timezone.now()
    run.events_received = 0
    run.events_processed = 0
    run.save(update_fields=["status", "error", "finished_at", "events_received", "events_processed"])
    connector.next_sync_at = timezone.now() + timedelta(hours=6)
    connector.last_sync_at = run.finished_at
    connector.save(update_fields=["last_sync_at", "next_sync_at", "updated_at"])
    return run
