from django.db import transaction

from apps.activities.services import create_activity_event
from apps.analytics.models import AnalyticsEvent
from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.clients.models import Client
from apps.clients.services import duplicate_payload, find_duplicate_clients
from apps.leads.models import Lead, LeadFormSubmission


def submit_lead_form(*, lead_form, payload, request=None):
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
    utm = {key: payload.get(key, "") for key in ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] if payload.get(key)}
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
            duplicate_json={"duplicates": duplicate_rows},
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
        run_automations_for_event(
            business=lead.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED, "lead_id": lead.id, "source": source, "utm": utm},
        )
    return submission


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
