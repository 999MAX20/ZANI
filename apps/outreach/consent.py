from django.utils import timezone

from apps.clients.models import Client
from apps.outreach.models import OutreachConsent
from apps.notifications.models import Notification
from apps.notifications.routing import MANAGER_ROLES, create_role_notification


OPT_OUT_WORDS = {"стоп", "stop", "unsubscribe", "отписаться", "не писать", "не отправлять", "отмена рассылки"}
OPT_IN_WORDS = {"start", "подписаться", "возобновить", "можно писать", "да, писать"}
EXPLICIT_CONSENT_KEYS = {
    "marketing_consent",
    "outreach_consent",
    "newsletter_consent",
    "whatsapp_consent",
    "telegram_consent",
}


def normalize_consent_text(text):
    return " ".join((text or "").strip().lower().split())


def is_opt_out_text(text):
    normalized = normalize_consent_text(text)
    return normalized in OPT_OUT_WORDS or normalized.startswith("стоп ")


def is_opt_in_text(text):
    normalized = normalize_consent_text(text)
    return normalized in OPT_IN_WORDS


def payload_has_explicit_consent(payload, *, channel=None):
    payload = payload or {}
    keys = {f"{channel}_consent"} if channel else EXPLICIT_CONSENT_KEYS
    keys |= {"marketing_consent", "outreach_consent", "newsletter_consent"}
    for key in keys:
        value = payload.get(key)
        if value is True:
            return True
        if isinstance(value, str) and value.strip().lower() in {"1", "true", "yes", "да", "on", "agree", "согласен"}:
            return True
    return False


def record_inbound_consent(*, business, channel, external_user_id, text, conversation=None):
    client = _resolve_client(business=business, channel=channel, external_user_id=external_user_id, conversation=conversation)
    if client is None:
        return {"status": "skipped", "reason": "Client was not found."}

    consent = OutreachConsent.objects.filter(business=business, client=client, channel=channel).first()
    now = timezone.now()
    if is_opt_out_text(text):
        consent, _ = OutreachConsent.objects.update_or_create(
            business=business,
            client=client,
            channel=channel,
            defaults={
                "status": OutreachConsent.Statuses.OPTED_OUT,
                "source": "inbound_keyword",
                "note": f"Opt-out from inbound message: {text[:160]}",
                "evidence_json": {
                    "conversation_id": getattr(conversation, "id", None),
                    "external_user_id": external_user_id,
                    "text": text[:500],
                },
                "opted_out_at": now,
            },
        )
        create_role_notification(
            business=business,
            client=client,
            category=Notification.Categories.OUTREACH,
            priority=Notification.Priorities.HIGH,
            text=f"Клиент отписался от {channel}: {client.full_name}",
            action_url=f"/app/clients?client={client.id}",
            action_label="Открыть клиента",
            roles=MANAGER_ROLES,
        )
        return {"status": "opted_out", "consent_id": consent.id}

    if consent and consent.status == OutreachConsent.Statuses.OPTED_OUT and not is_opt_in_text(text):
        return {"status": "kept_opted_out", "consent_id": consent.id}

    if is_opt_in_text(text) or consent is None:
        consent, _ = OutreachConsent.objects.update_or_create(
            business=business,
            client=client,
            channel=channel,
            defaults={
                "status": OutreachConsent.Statuses.OPTED_IN,
                "source": "inbound_message",
                "note": "Client initiated the channel conversation.",
                "evidence_json": {
                    "conversation_id": getattr(conversation, "id", None),
                    "external_user_id": external_user_id,
                    "text": text[:500],
                },
                "opted_in_at": now,
                "opted_out_at": None,
            },
        )
        return {"status": "opted_in", "consent_id": consent.id}

    return {"status": "unchanged", "consent_id": consent.id}


def _resolve_client(*, business, channel, external_user_id, conversation=None):
    if conversation is not None:
        conversation.refresh_from_db(fields=["client"])
        if conversation.client_id:
            return conversation.client
    if channel == OutreachConsent.Channels.TELEGRAM:
        return Client.objects.filter(business=business, telegram_id=external_user_id, is_archived=False).first()
    if channel == OutreachConsent.Channels.WHATSAPP:
        return (
            Client.objects.filter(business=business, whatsapp_id=external_user_id, is_archived=False).first()
            or Client.objects.filter(business=business, phone=external_user_id, is_archived=False).first()
        )
    return None
