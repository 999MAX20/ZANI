from urllib.parse import urlparse

from django.db import transaction

from apps.activities.services import create_activity_event
from apps.analytics.models import AnalyticsEvent
from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.clients.models import Client
from apps.clients.services import duplicate_payload, find_duplicate_clients
from apps.leads.models import Lead, LeadFormSubmission, LeadFormSubmissionError
from apps.notifications.models import Notification
from apps.integrations.sanitization import sanitize_config
from apps.outreach.consent import payload_has_explicit_consent
from apps.outreach.models import OutreachCampaign
from apps.outreach.services import record_explicit_consent


HONEYPOT_FIELDS = {"website_url", "company_website", "homepage"}
MAX_PUBLIC_FORM_FIELDS = 50
MAX_PUBLIC_FORM_STRING_LENGTH = 2000
MAX_PUBLIC_FORM_TOTAL_CHARS = 20000
MAX_STORED_URL_LENGTH = 200
MAX_STORED_DOMAIN_LENGTH = 255
MAX_STORED_USER_AGENT_LENGTH = 1000


def submit_lead_form(*, lead_form, payload, request=None):
    payload = normalize_public_form_payload(payload)
    safe_payload = sanitize_config(payload)
    spam_fields = [field for field in HONEYPOT_FIELDS if str(payload.get(field, "")).strip()]
    if spam_fields:
        raise ValueError("Submission rejected.")

    required_missing = []
    for field in lead_form.fields.all():
        if field.is_required and not str(payload.get(field.key, "")).strip():
            required_missing.append(field.key)
    if required_missing:
        raise ValueError(f"Required fields missing: {', '.join(required_missing)}")

    full_name = payload.get("full_name") or payload.get("name") or payload.get("client_name") or ""
    phone = payload.get("phone") or payload.get("whatsapp") or ""
    email = payload.get("email") or ""
    message = payload.get("message") or payload.get("notes") or ""
    source = payload.get("source") or lead_form.source or Lead.Sources.WEBSITE
    landing_id = str(payload.get("landing_id") or lead_form.landing_id or "").strip()
    page_url = _truncate(str(payload.get("page_url") or payload.get("url") or "").strip(), MAX_STORED_URL_LENGTH)
    page_domain = _truncate(_page_domain(page_url) or str(payload.get("domain") or lead_form.landing_domain or "").strip(), MAX_STORED_DOMAIN_LENGTH)
    utm = {key: payload.get(key, "") for key in ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] if payload.get(key)}
    source_context = {
        "source": source,
        "campaign": payload.get("campaign") or payload.get("utm_campaign") or "",
        "landing_id": landing_id,
        "page_url": page_url,
        "page_domain": page_domain,
        "referrer": _truncate(request.META.get("HTTP_REFERER", "") if request else "", MAX_STORED_URL_LENGTH),
    }
    duplicates = find_duplicate_clients(lead_form.business, phone=phone, email=email)
    duplicate_rows = duplicate_payload(duplicates, phone=phone, email=email)

    with transaction.atomic():
        if duplicates:
            client = duplicates[0]
        else:
            client = Client.objects.create(
                business=lead_form.business,
                full_name=full_name or phone or email or "Новая заявка",
                phone=phone,
                email=email,
                source=_client_source(source),
                notes=message,
            )
        if phone and payload_has_explicit_consent(payload, channel=OutreachCampaign.Channels.WHATSAPP):
            record_explicit_consent(
                client=client,
                channel=OutreachCampaign.Channels.WHATSAPP,
                source="lead_form",
                note=f"Explicit consent from form {lead_form.public_id}.",
                evidence={"lead_form": str(lead_form.public_id), "fields": {key: payload.get(key) for key in ["marketing_consent", "outreach_consent", "newsletter_consent", "whatsapp_consent"]}},
            )
        lead = Lead.objects.create(
            business=lead_form.business,
            client=client,
            source=_lead_source(source),
            message=message,
            responsible_user=lead_form.default_responsible_user or lead_form.business.owner,
        )
        submission = LeadFormSubmission.objects.create(
            form=lead_form,
            business=lead_form.business,
            client=client,
            lead=lead,
            payload_json=safe_payload,
            utm_json=utm,
            source_context_json=source_context,
            duplicate_json={"duplicates": duplicate_rows},
            landing_id=landing_id,
            page_url=page_url,
            page_domain=page_domain,
            ip_address=_client_ip(request),
            user_agent=_truncate(request.META.get("HTTP_USER_AGENT", "") if request else "", MAX_STORED_USER_AGENT_LENGTH),
        )
        AnalyticsEvent.objects.create(
            business=lead_form.business,
            client=client,
            event_type=AnalyticsEvent.EventTypes.FORM_SUBMITTED,
            source=source,
            metadata={"lead_form": str(lead_form.public_id), "submission": submission.id, "utm": utm},
        )
        create_activity_event(
            business=lead_form.business,
            client=client,
            event_type="form_submitted",
            source="lead_form",
            instance=lead,
            text=f"Форма «{lead_form.name}» отправлена",
            metadata={"submission": submission.id, "duplicates": duplicate_rows, "utm": utm},
        )
        Notification.objects.create(
            business=lead.business,
            recipient=lead.responsible_user,
            client=client,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.HIGH,
            text=f"Новая заявка с формы: {client.full_name}",
            send_at=submission.created_at,
            action_url=f"/app/leads?lead={lead.id}",
            action_label="Открыть заявку",
        )
        run_automations_for_event(
            business=lead.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED, "lead_id": lead.id, "source": source, "utm": utm},
        )
    return submission


def log_lead_form_submission_error(*, form=None, public_id="", payload=None, error_message="", request=None):
    try:
        payload = normalize_public_form_payload(payload or {})
    except ValueError:
        payload = {}
    safe_payload = sanitize_config(payload)
    page_url = _truncate(str(payload.get("page_url") or payload.get("url") or "").strip(), MAX_STORED_URL_LENGTH)
    page_domain = _truncate(_page_domain(page_url) or str(payload.get("domain") or getattr(form, "landing_domain", "") or "").strip(), MAX_STORED_DOMAIN_LENGTH)
    return LeadFormSubmissionError.objects.create(
        form=form,
        business=getattr(form, "business", None),
        public_id=str(public_id or getattr(form, "public_id", "") or ""),
        landing_id=str(payload.get("landing_id") or getattr(form, "landing_id", "") or "").strip(),
        page_url=page_url,
        page_domain=page_domain,
        payload_json=safe_payload,
        error_message=str(error_message),
        ip_address=_client_ip(request),
        user_agent=_truncate(request.META.get("HTTP_USER_AGENT", "") if request else "", MAX_STORED_USER_AGENT_LENGTH),
    )


def normalize_public_form_payload(payload):
    payload = dict(payload or {})
    if len(payload) > MAX_PUBLIC_FORM_FIELDS:
        raise ValueError("Submission has too many fields.")
    total = 0
    normalized = {}
    for key, value in payload.items():
        key_text = str(key or "").strip()
        if not key_text:
            continue
        normalized_value, value_size = _normalize_public_form_value(value)
        total += len(key_text) + value_size
        if total > MAX_PUBLIC_FORM_TOTAL_CHARS:
            raise ValueError("Submission is too large.")
        normalized[key_text[:128]] = normalized_value
    return normalized


def _normalize_public_form_value(value):
    if isinstance(value, dict):
        normalized = {}
        total = 0
        for key, item in list(value.items())[:MAX_PUBLIC_FORM_FIELDS]:
            normalized_item, item_size = _normalize_public_form_value(item)
            key_text = str(key or "").strip()[:128]
            normalized[key_text] = normalized_item
            total += len(key_text) + item_size
        return normalized, total
    if isinstance(value, list):
        normalized_items = []
        total = 0
        for item in value[:MAX_PUBLIC_FORM_FIELDS]:
            normalized_item, item_size = _normalize_public_form_value(item)
            normalized_items.append(normalized_item)
            total += item_size
        return normalized_items, total
    text = str(value or "").strip()
    if len(text) > MAX_PUBLIC_FORM_STRING_LENGTH:
        raise ValueError("Submission field is too long.")
    return text, len(text)


def _truncate(value, max_length):
    return str(value or "")[:max_length]


def _client_source(source):
    return source if source in Client.Sources.values else Client.Sources.OTHER


def _lead_source(source):
    return source if source in Lead.Sources.values else Lead.Sources.WEBSITE


def _client_ip(request):
    if request is None:
        return None
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _page_domain(page_url):
    if not page_url:
        return ""
    parsed = urlparse(page_url)
    return parsed.netloc.lower()
