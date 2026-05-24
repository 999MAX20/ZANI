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


HONEYPOT_FIELDS = {"website_url", "company_website", "homepage"}


def submit_lead_form(*, lead_form, payload, request=None):
    payload = dict(payload)
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
    page_url = str(payload.get("page_url") or payload.get("url") or "").strip()
    page_domain = _page_domain(page_url) or str(payload.get("domain") or lead_form.landing_domain or "").strip()
    utm = {key: payload.get(key, "") for key in ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] if payload.get(key)}
    source_context = {
        "source": source,
        "campaign": payload.get("campaign") or payload.get("utm_campaign") or "",
        "landing_id": landing_id,
        "page_url": page_url,
        "page_domain": page_domain,
        "referrer": request.META.get("HTTP_REFERER", "") if request else "",
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
            payload_json=payload,
            utm_json=utm,
            source_context_json=source_context,
            duplicate_json={"duplicates": duplicate_rows},
            landing_id=landing_id,
            page_url=page_url,
            page_domain=page_domain,
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "") if request else "",
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
            action_url=f"/dashboard/leads?lead={lead.id}",
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
    payload = dict(payload or {})
    page_url = str(payload.get("page_url") or payload.get("url") or "").strip()
    page_domain = _page_domain(page_url) or str(payload.get("domain") or getattr(form, "landing_domain", "") or "").strip()
    return LeadFormSubmissionError.objects.create(
        form=form,
        business=getattr(form, "business", None),
        public_id=str(public_id or getattr(form, "public_id", "") or ""),
        landing_id=str(payload.get("landing_id") or getattr(form, "landing_id", "") or "").strip(),
        page_url=page_url,
        page_domain=page_domain,
        payload_json=payload,
        error_message=str(error_message),
        ip_address=_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "") if request else "",
    )


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
