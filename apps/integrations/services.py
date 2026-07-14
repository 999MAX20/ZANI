from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.integrations.connectors import create_or_update_credential, defaults_for_provider, normalize_business_event, run_connector_healthcheck
from apps.integrations.instagram_oauth import build_instagram_oauth_url, complete_instagram_oauth
from apps.integrations.kaspi import build_kaspi_mock_events, kaspi_connector_safe_config, validate_kaspi_credentials
from apps.integrations.models import BusinessConnector
from apps.integrations.moysklad import build_moysklad_mock_events, moysklad_connector_safe_config, validate_moysklad_credentials
from apps.integrations.one_c import build_one_c_mock_events
from apps.integrations.ozon import build_ozon_mock_events, ozon_connector_safe_config, validate_ozon_credentials
from apps.integrations.sync_service import execute_connector_sync
from apps.integrations.whatsapp.embedded_signup import build_embedded_signup_url, complete_embedded_signup
from apps.integrations.wildberries import build_wildberries_mock_events, validate_wildberries_credentials, wildberries_connector_safe_config


CONNECTOR_CONFIG_SPECS = {
    BusinessConnector.Providers.KASPI: {
        "name": "Kaspi",
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "audit_kind": "kaspi_config_saved",
        "credential_inputs": {"api_token": ("api_token", "api_token_configured")},
        "required_configured_keys": ["api_token_configured"],
        "config": lambda connector, data: {
            "merchant_id": data.get("merchant_id", (connector.config_json or {}).get("merchant_id", "")),
            "order_state": data.get("order_state", (connector.config_json or {}).get("order_state", "ARCHIVE")),
            "sync_days": data.get("sync_days", (connector.config_json or {}).get("sync_days", 14)),
            "page_size": data.get("page_size", (connector.config_json or {}).get("page_size", 20)),
            "read_only": True,
            "api_token_configured": connector.credentials.filter(key="api_token").exists(),
            "last_operation": "config",
        },
    },
    BusinessConnector.Providers.MOYSKLAD: {
        "capability": BusinessConnector.Capabilities.INVENTORY,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "audit_kind": "moysklad_config_saved",
        "credential_inputs": {"access_token": ("access_token", "access_token_configured")},
        "required_configured_keys": ["access_token_configured"],
        "config": lambda connector, data: {
            "entities": data.get("entities", (connector.config_json or {}).get("entities", ["products", "stock", "sales", "clients"])),
            "page_size": data.get("page_size", (connector.config_json or {}).get("page_size", 50)),
            "read_only": True,
            "access_token_configured": connector.credentials.filter(key="access_token").exists(),
            "auth_mode": "access_token",
            "future_auth_mode": "moysklad_marketplace_app",
            "last_operation": "config",
        },
    },
    BusinessConnector.Providers.WILDBERRIES: {
        "name": "Wildberries",
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "audit_kind": "wildberries_config_saved",
        "credential_inputs": {"api_token": ("api_token", "api_token_configured")},
        "required_configured_keys": ["api_token_configured"],
        "config": lambda connector, data: {
            "entities": data.get("entities", (connector.config_json or {}).get("entities", ["orders", "sales"])),
            "sync_days": data.get("sync_days", (connector.config_json or {}).get("sync_days", 7)),
            "read_only": True,
            "api_token_configured": connector.credentials.filter(key="api_token").exists(),
            "auth_mode": "statistics_token",
            "last_operation": "config",
        },
    },
    BusinessConnector.Providers.OZON: {
        "name": "Ozon",
        "capability": BusinessConnector.Capabilities.FINANCE,
        "auth_type": BusinessConnector.AuthTypes.TOKEN,
        "audit_kind": "ozon_config_saved",
        "credential_inputs": {
            "client_id": ("client_id", "client_id_configured"),
            "api_key": ("api_key", "api_key_configured"),
        },
        "required_configured_keys": ["client_id_configured", "api_key_configured"],
        "config": lambda connector, data: {
            "entities": data.get("entities", (connector.config_json or {}).get("entities", ["fbs_postings", "fbo_postings", "stocks"])),
            "sync_days": data.get("sync_days", (connector.config_json or {}).get("sync_days", 7)),
            "limit": data.get("limit", (connector.config_json or {}).get("limit", 50)),
            "read_only": True,
            "client_id_configured": connector.credentials.filter(key="client_id").exists(),
            "api_key_configured": connector.credentials.filter(key="api_key").exists(),
            "auth_mode": "client_id_api_key",
            "last_operation": "config",
        },
    },
}


CONNECTOR_STATUS_SPECS = {
    BusinessConnector.Providers.KASPI: {
        "safe_config": kaspi_connector_safe_config,
        "enabled_key": "kaspi_enabled",
        "enabled": lambda: settings.KASPI_ENABLED,
        "api_base_url_key": "api_base_url",
        "api_base_url": lambda: settings.KASPI_API_BASE_URL,
        "credentials": {"api_token_configured": "api_token"},
    },
    BusinessConnector.Providers.MOYSKLAD: {
        "safe_config": moysklad_connector_safe_config,
        "enabled_key": "moysklad_enabled",
        "enabled": lambda: settings.MOYSKLAD_ENABLED,
        "api_base_url_key": "api_base_url",
        "api_base_url": lambda: settings.MOYSKLAD_API_BASE_URL,
        "credentials": {"access_token_configured": "access_token"},
    },
    BusinessConnector.Providers.WILDBERRIES: {
        "safe_config": wildberries_connector_safe_config,
        "enabled_key": "wildberries_enabled",
        "enabled": lambda: settings.WILDBERRIES_ENABLED,
        "api_base_url_key": "api_base_url",
        "api_base_url": lambda: settings.WILDBERRIES_STATISTICS_API_BASE_URL,
        "credentials": {"api_token_configured": "api_token"},
    },
    BusinessConnector.Providers.OZON: {
        "safe_config": ozon_connector_safe_config,
        "enabled_key": "ozon_enabled",
        "enabled": lambda: settings.OZON_ENABLED,
        "api_base_url_key": "api_base_url",
        "api_base_url": lambda: settings.OZON_SELLER_API_BASE_URL,
        "credentials": {"client_id_configured": "client_id", "api_key_configured": "api_key"},
    },
}


CONNECTOR_TEST_SPECS = {
    BusinessConnector.Providers.KASPI: {
        "validate": validate_kaspi_credentials,
        "failure": "Kaspi credentials validation failed.",
        "credentials": {"api_token_configured": "api_token"},
        "metrics": {"orders_count": 0},
    },
    BusinessConnector.Providers.MOYSKLAD: {
        "validate": validate_moysklad_credentials,
        "failure": "MoySklad credentials validation failed.",
        "credentials": {"access_token_configured": "access_token"},
        "metrics": {"rows_count": 0},
    },
    BusinessConnector.Providers.WILDBERRIES: {
        "validate": validate_wildberries_credentials,
        "failure": "Wildberries credentials validation failed.",
        "credentials": {"api_token_configured": "api_token"},
        "metrics": {"rows_count": 0},
    },
    BusinessConnector.Providers.OZON: {
        "validate": validate_ozon_credentials,
        "failure": "Ozon credentials validation failed.",
        "credentials": {"client_id_configured": "client_id", "api_key_configured": "api_key"},
        "metrics": {"warehouses_count": 0},
    },
}


def save_provider_connector_config(*, business, user, provider, validated_data, request=None):
    spec = CONNECTOR_CONFIG_SPECS[provider]
    connector, created = BusinessConnector.objects.get_or_create(
        business=business,
        provider=provider,
        name=spec.get("name") or defaults_for_provider(provider)["label"],
        defaults={
            "capability": spec["capability"],
            "auth_type": spec["auth_type"],
            "status": BusinessConnector.Statuses.NEEDS_ATTENTION,
            "created_by": user,
        },
    )
    config = dict(connector.config_json or {})
    config.update(spec["config"](connector, validated_data))
    for input_key, (credential_key, configured_key) in spec["credential_inputs"].items():
        raw_value = validated_data.get(input_key, "")
        if raw_value:
            create_or_update_credential(connector, credential_key, raw_value)
            config[configured_key] = True

    connector.capability = spec["capability"]
    connector.auth_type = spec["auth_type"]
    connector.status = (
        BusinessConnector.Statuses.CONNECTED
        if all(config.get(key) for key in spec["required_configured_keys"])
        else BusinessConnector.Statuses.NEEDS_ATTENTION
    )
    connector.config_json = config
    connector.last_error = ""
    if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    connector.save(update_fields=["capability", "auth_type", "status", "config_json", "last_error", "connected_at", "updated_at"])

    if request is not None:
        write_audit_log(
            request,
            AuditLog.Actions.CREATE if created else AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": spec["audit_kind"], **{key: config.get(key, False) for key in spec["required_configured_keys"]}},
        )
    return connector, created


def save_whatsapp_connection_request(*, business, user, config, request=None):
    decision = config["provider_decision"]
    connector, created = BusinessConnector.objects.update_or_create(
        business=business,
        provider=BusinessConnector.Providers.WHATSAPP,
        name="WhatsApp connection request",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": BusinessConnector.AuthTypes.QR,
            "status": decision["status"],
            "config_json": config,
            "scopes_json": [],
            "last_error": "",
            "created_by": user,
        },
    )
    if request is not None:
        write_audit_log(
            request,
            AuditLog.Actions.CREATE if created else AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": "whatsapp_connection_request_saved", "provider_decision": decision["provider_key"]},
        )
    return connector, created


def start_whatsapp_embedded_signup(*, business, user, redirect_uri):
    authorization_url, state = build_embedded_signup_url(business=business, user=user, redirect_uri=redirect_uri)
    return {
        "authorization_url": authorization_url,
        "state": state,
        "redirect_uri": redirect_uri,
        "app_configured": bool(settings.META_APP_ID and settings.META_APP_SECRET),
        "config_id_configured": bool(settings.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID),
        "app_id": settings.META_APP_ID,
        "config_id": settings.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID,
        "graph_api_version": settings.WHATSAPP_GRAPH_API_VERSION,
    }


def complete_whatsapp_embedded_signup(*, business, user, code, state, redirect_uri, phone_number_id, waba_id="", display_phone_number="", request=None):
    channel, connector = complete_embedded_signup(
        business=business,
        user=user,
        code=code,
        state=state,
        redirect_uri=redirect_uri,
        phone_number_id=phone_number_id,
        waba_id=waba_id,
        display_phone_number=display_phone_number,
    )
    if request is not None:
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": "whatsapp_embedded_signup_completed", "bot_channel_id": channel.id},
        )
    return channel, connector


def start_instagram_oauth(*, business, user, redirect_uri):
    authorization_url, state = build_instagram_oauth_url(business=business, user=user, redirect_uri=redirect_uri)
    return {
        "authorization_url": authorization_url,
        "state": state,
        "redirect_uri": redirect_uri,
        "app_configured": bool(settings.META_APP_ID and settings.META_APP_SECRET),
        "app_id": settings.META_APP_ID,
        "graph_api_version": settings.INSTAGRAM_GRAPH_API_VERSION,
    }


def complete_instagram_connection(*, business, user, code, state, redirect_uri, page_id="", request=None):
    channel, connector = complete_instagram_oauth(
        business=business,
        user=user,
        code=code,
        state=state,
        redirect_uri=redirect_uri,
        page_id=page_id,
    )
    if request is not None:
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": "instagram_oauth_completed", "bot_channel_id": channel.id},
        )
    return channel, connector


def connect_business_connector(*, connector, request=None):
    connector.status = BusinessConnector.Statuses.CONNECTED
    connector.last_error = ""
    connector.connected_at = connector.connected_at or timezone.now()
    connector.save(update_fields=["status", "last_error", "connected_at", "updated_at"])
    if request is not None:
        write_audit_log(request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "business_connector_connected"})
    return connector


def disconnect_business_connector(*, connector, request=None):
    connector.status = BusinessConnector.Statuses.DISABLED
    connector.save(update_fields=["status", "updated_at"])
    if request is not None:
        write_audit_log(request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "business_connector_disconnected"})
    return connector


def connector_healthcheck(connector):
    return run_connector_healthcheck(connector)


def connector_status_payload(connector, expected_provider):
    _ensure_connector_provider(connector, expected_provider)
    spec = CONNECTOR_STATUS_SPECS[expected_provider]
    payload = {
        "status": connector.status,
        "last_error": connector.last_error,
        "last_sync_at": connector.last_sync_at,
        "next_sync_at": connector.next_sync_at,
        spec["enabled_key"]: spec["enabled"](),
        spec["api_base_url_key"]: spec["api_base_url"](),
        **spec["safe_config"](connector),
    }
    for output_key, credential_key in spec["credentials"].items():
        payload[output_key] = connector.credentials.filter(key=credential_key).exists()
    return payload


def test_connector_connection(connector, expected_provider):
    _ensure_connector_provider(connector, expected_provider)
    spec = CONNECTOR_TEST_SPECS[expected_provider]
    result = spec["validate"](connector)
    connector.status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
    connector.last_error = "" if result.get("ok") else result.get("reason", spec["failure"])
    if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    connector.save(update_fields=["status", "last_error", "connected_at", "updated_at"])

    payload = {
        "ok": result.get("ok", False),
        "mock": result.get("mock", False),
        "reason": result.get("reason", ""),
        "status": connector.status,
    }
    for output_key, credential_key in spec["credentials"].items():
        payload[output_key] = connector.credentials.filter(key=credential_key).exists()
    for output_key, default_value in spec["metrics"].items():
        payload[output_key] = result.get(output_key, default_value)
    return payload


def sync_connector(connector, expected_provider, *, request=None):
    _ensure_connector_provider(connector, expected_provider)
    result = execute_connector_sync(connector)
    if request is not None:
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            connector,
            business=connector.business,
            metadata={"kind": result["audit_kind"], "events": len(result["events"]), "mock": result.get("mock", False)},
        )
    return result


def ingest_connector_business_event(*, connector, data):
    return normalize_business_event(
        business=connector.business,
        connector=connector,
        source=connector.provider,
        event_type=data.get("event_type", "integration.event"),
        external_id=data.get("external_id", ""),
        payload=data.get("payload_json", data.get("payload", {})),
    )


def mock_sync_connector(connector, *, request=None):
    mock_events = build_connector_mock_events(connector)
    if not mock_events:
        raise ValidationError({"detail": "Mock sync is available only for lightweight data connectors."})

    events = []
    for item in mock_events:
        payload = item.payload if hasattr(item, "payload") else item["payload"]
        event_type = item.event_type if hasattr(item, "event_type") else item["event_type"]
        external_id = item.external_id if hasattr(item, "external_id") else item["external_id"]
        event, _created = normalize_business_event(
            business=connector.business,
            connector=connector,
            source=connector.provider,
            event_type=event_type,
            external_id=external_id,
            payload=payload,
        )
        events.append(event)

    connector.last_sync_at = timezone.now()
    connector.save(update_fields=["last_sync_at", "updated_at"])
    if request is not None:
        write_audit_log(request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "connector_mock_sync", "events": len(events)})
    return events


def build_connector_mock_events(connector):
    prefix = f"demo-{connector.provider}-{connector.id}"
    if connector.provider == BusinessConnector.Providers.KASPI:
        return build_kaspi_mock_events(prefix=prefix)
    if connector.provider == BusinessConnector.Providers.ONE_C:
        return build_one_c_mock_events(prefix=prefix)
    if connector.provider == BusinessConnector.Providers.MOYSKLAD:
        return build_moysklad_mock_events(prefix=prefix)
    if connector.provider == BusinessConnector.Providers.WILDBERRIES:
        return build_wildberries_mock_events(prefix=prefix)
    if connector.provider == BusinessConnector.Providers.OZON:
        return build_ozon_mock_events(prefix=prefix)
    return []


def _ensure_connector_provider(connector, expected_provider):
    if connector.provider != expected_provider:
        label = defaults_for_provider(expected_provider)["label"]
        raise ValidationError({"detail": f"This action is only available for {label} connectors."})
