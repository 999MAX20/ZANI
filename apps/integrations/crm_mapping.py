from django.utils import timezone

from apps.integrations.connectors import CONNECTOR_PROVIDER_CAPABILITIES, normalize_business_event
from apps.integrations.models import BusinessConnector


MESSAGE_RECEIVED_EVENT = "message.received"
LEAD_CAPTURED_EVENT = "lead.captured"
CLIENT_IMPORTED_EVENT = "client.imported"
LEAD_IMPORTED_EVENT = "lead.imported"
DEAL_IMPORTED_EVENT = "deal.imported"


def ensure_connector_for_source(business, provider, *, name=""):
    connector = BusinessConnector.objects.filter(business=business, provider=provider).order_by("id").first()
    if connector:
        return connector

    provider_defaults = CONNECTOR_PROVIDER_CAPABILITIES.get(provider, {})
    return BusinessConnector.objects.create(
        business=business,
        provider=provider,
        name=name or provider_defaults.get("label") or provider,
        capability=provider_defaults.get("capability") or BusinessConnector.Capabilities.CUSTOM,
        auth_type=provider_defaults.get("auth_type") or BusinessConnector.AuthTypes.NONE,
        status=BusinessConnector.Statuses.CONNECTED,
        connected_at=timezone.now(),
        config_json={"source": "crm_mapping"},
    )


def touch_connector_activity(connector, *, occurred_at=None):
    if connector is None:
        return
    update_fields = ["status", "last_error", "last_sync_at", "updated_at"]
    if connector.status != BusinessConnector.Statuses.DISABLED:
        connector.status = BusinessConnector.Statuses.CONNECTED
    connector.last_error = ""
    connector.last_sync_at = occurred_at or timezone.now()
    if connector.connected_at is None:
        connector.connected_at = timezone.now()
        update_fields.append("connected_at")
    connector.save(update_fields=update_fields)


def record_message_received_event(*, conversation, message, provider=None, connector=None, extra_payload=None):
    provider = provider or conversation.channel
    conversation.refresh_from_db()
    connector = connector or ensure_connector_for_source(conversation.business, provider)
    payload = {
        "provider": provider,
        "channel": conversation.channel,
        "conversation_id": conversation.id,
        "conversation_public_id": str(conversation.public_id),
        "message_id": message.id,
        "external_message_id": message.external_message_id,
        "external_user_id": conversation.external_user_id,
        "direction": message.direction,
        "sender_type": message.sender_type,
        "text": message.text,
        "client_id": conversation.client_id,
        "lead_id": conversation.lead_id,
        "deal_id": conversation.deal_id,
    }
    if extra_payload:
        payload.update(extra_payload)
    event, created = normalize_business_event(
        business=conversation.business,
        connector=connector,
        source=provider,
        event_type=MESSAGE_RECEIVED_EVENT,
        external_id=message.external_message_id or f"{provider}:message:{message.id}",
        payload=payload,
        occurred_at=message.created_at,
    )
    if created:
        touch_connector_activity(connector, occurred_at=event.occurred_at)
    return event, created


def record_lead_captured_event(*, lead, client=None, provider=BusinessConnector.Providers.WEBSITE, connector=None, external_id="", payload=None):
    connector = connector or ensure_connector_for_source(lead.business, provider)
    client = client or lead.client
    event_payload = {
        "provider": provider,
        "lead_id": lead.id,
        "client_id": client.id if client else None,
        "source": lead.source,
        "message": lead.message,
    }
    if payload:
        event_payload.update(payload)
    event, created = normalize_business_event(
        business=lead.business,
        connector=connector,
        source=provider,
        event_type=LEAD_CAPTURED_EVENT,
        external_id=external_id or f"{provider}:lead:{lead.id}",
        payload=event_payload,
        occurred_at=lead.created_at,
    )
    if created:
        touch_connector_activity(connector, occurred_at=event.occurred_at)
    return event, created


def record_import_event(*, business, connector, event_type, payload, external_id=""):
    event, created = normalize_business_event(
        business=business,
        connector=connector,
        source=connector.provider if connector else BusinessConnector.Providers.EXCEL_CSV,
        event_type=event_type,
        external_id=external_id,
        payload=payload,
    )
    if created:
        touch_connector_activity(connector, occurred_at=event.occurred_at)
    return event, created


def record_connector_events(connector, items):
    events = []
    for item in items:
        event_type = getattr(item, "event_type", None) or item.get("event_type")
        payload = getattr(item, "payload", None) if hasattr(item, "payload") else item.get("payload", {})
        external_id = getattr(item, "external_id", None) if hasattr(item, "external_id") else item.get("external_id", "")
        event, _created = normalize_business_event(
            business=connector.business,
            connector=connector,
            source=connector.provider,
            event_type=event_type,
            external_id=external_id,
            payload=payload,
        )
        events.append(event)
    return events
