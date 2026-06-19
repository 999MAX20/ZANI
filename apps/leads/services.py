from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.notifications.models import Notification


@dataclass(frozen=True)
class LeadDealResult:
    deal: Deal
    created: bool


def assign_lead(*, lead: Lead, actor, user_id=None, request=None) -> Lead:
    responsible_user_id = user_id or actor.id
    responsible_user = get_user_model().objects.filter(id=responsible_user_id, is_active=True).first()
    if responsible_user is None:
        raise ValidationError({"user_id": "User was not found."})
    if not lead.business.members.filter(user=responsible_user, is_active=True).exists():
        raise ValidationError({"user_id": "Responsible user must be an active business member."})

    previous_responsible_user_id = lead.responsible_user_id
    lead.responsible_user = responsible_user
    lead.save(update_fields=["responsible_user", "updated_at"])
    if request is not None:
        write_audit_log(request, AuditLog.Actions.UPDATE, lead, metadata={"kind": "assignment", "responsible_user": responsible_user.id})
    create_activity_event(
        business=lead.business,
        client=lead.client,
        actor=actor,
        event_type=ActivityEvents.LEAD_ASSIGNED,
        instance=lead,
        text="Ответственный по заявке обновлён",
        metadata={"from": previous_responsible_user_id, "to": responsible_user.id},
    )
    return lead


def take_lead_in_work(*, lead: Lead, actor, request=None) -> Lead:
    if lead.status not in {Lead.Statuses.NEW, Lead.Statuses.CONTACTED, Lead.Statuses.LOST}:
        raise ValidationError({"status": "Only new, contacted or lost leads can be taken into work."})
    return apply_lead_status(
        lead=lead,
        actor=actor,
        request=request,
        status=Lead.Statuses.IN_PROGRESS,
        event_type=ActivityEvents.LEAD_TAKEN_IN_WORK,
        text="Заявка взята в работу",
    )


def mark_lead_contacted(*, lead: Lead, actor, request=None) -> Lead:
    return apply_lead_status(
        lead=lead,
        actor=actor,
        request=request,
        status=Lead.Statuses.CONTACTED,
        event_type=ActivityEvents.LEAD_CONTACTED,
        text="С клиентом по заявке связались",
    )


def mark_lead_closed(*, lead: Lead, actor, request=None) -> Lead:
    return apply_lead_status(
        lead=lead,
        actor=actor,
        request=request,
        status=Lead.Statuses.CLOSED,
        event_type=ActivityEvents.LEAD_CLOSED,
        text="Заявка закрыта успешно",
    )


def mark_lead_lost(*, lead: Lead, actor, lost_reason: str, request=None) -> Lead:
    lost_reason = (lost_reason or "").strip()
    if not lost_reason:
        raise ValidationError({"lost_reason": "Reason is required when lead is lost."})
    return apply_lead_status(
        lead=lead,
        actor=actor,
        request=request,
        status=Lead.Statuses.LOST,
        event_type=ActivityEvents.LEAD_LOST,
        text="Заявка закрыта как отказ",
        lost_reason=lost_reason,
    )


def reopen_lead(*, lead: Lead, actor, request=None) -> Lead:
    target_status = lead.previous_status if lead.previous_status and lead.previous_status != Lead.Statuses.LOST else Lead.Statuses.IN_PROGRESS
    return apply_lead_status(
        lead=lead,
        actor=actor,
        request=request,
        status=target_status,
        event_type=ActivityEvents.LEAD_REOPENED,
        text="Заявка возвращена в работу",
        clear_lost=True,
    )


def create_deal_from_lead(*, lead: Lead, actor, amount=0, title="", request=None) -> LeadDealResult:
    existing_deal = lead.deals.filter(is_archived=False).order_by("-updated_at").first()
    if existing_deal:
        return LeadDealResult(deal=existing_deal, created=False)

    pipeline = Pipeline.objects.filter(business=lead.business, is_default=True).first() or Pipeline.objects.filter(business=lead.business).order_by("id").first()
    if pipeline is None:
        pipeline = Pipeline.objects.create(
            business=lead.business,
            name="CRM Light",
            slug=f"crm-light-{lead.business_id}",
            is_default=True,
        )
    stage = PipelineStage.objects.filter(business=lead.business, pipeline=pipeline, is_won=False, is_lost=False).order_by("order", "id").first()
    if stage is None:
        stage = PipelineStage.objects.create(
            business=lead.business,
            pipeline=pipeline,
            name="Новая сделка",
            order=1,
            probability=10,
        )

    deal = Deal.objects.create(
        business=lead.business,
        client=lead.client,
        lead=lead,
        pipeline=pipeline,
        stage=stage,
        title=(title or f"Сделка по заявке #{lead.id} — {lead.client}").strip(),
        amount=amount or 0,
        source=lead.source,
        owner=lead.responsible_user or actor,
        probability=stage.probability,
        stage_entered_at=timezone.now(),
    )
    previous_status = lead.status
    lead.status = Lead.Statuses.IN_PROGRESS
    lead.previous_status = previous_status if previous_status != Lead.Statuses.IN_PROGRESS else lead.previous_status
    lead.save(update_fields=["status", "previous_status", "updated_at"])
    if request is not None:
        write_audit_log(request, AuditLog.Actions.CREATE, deal)
    create_activity_event(
        business=lead.business,
        client=lead.client,
        actor=actor,
        event_type=ActivityEvents.DEAL_CREATED_FROM_LEAD,
        instance=deal,
        text="Сделка создана из заявки",
        metadata={"lead_id": lead.id},
    )
    notify_responsible(lead, f"По заявке создана сделка: {deal.title}", action_url=f"/app/deals?deal={deal.id}")
    return LeadDealResult(deal=deal, created=True)


def apply_lead_status(*, lead: Lead, actor, status: str, event_type: str, text: str, request=None, lost_reason=None, clear_lost=False) -> Lead:
    previous_status = lead.status
    now = timezone.now()
    lead.status = status
    if status == Lead.Statuses.LOST:
        lead.previous_status = previous_status if previous_status != Lead.Statuses.LOST else ""
        lead.lost_reason = lost_reason or lead.lost_reason
        lead.lost_at = now
        lead.lost_by = actor
    elif clear_lost or status != Lead.Statuses.LOST:
        if previous_status != status:
            lead.previous_status = previous_status
        lead.lost_reason = ""
        lead.lost_at = None
        lead.lost_by = None
    lead.save(update_fields=["status", "previous_status", "lost_reason", "lost_at", "lost_by", "updated_at"])
    if request is not None:
        metadata = {"kind": "lifecycle", "from": previous_status, "to": status, "lifecycle_action": f"lead_{status}"}
        if status == Lead.Statuses.LOST:
            metadata.update({"lost": True, "lost_reason": lead.lost_reason})
        if event_type == ActivityEvents.LEAD_REOPENED:
            metadata["lifecycle_action"] = "lead_reopened"
        write_audit_log(request, AuditLog.Actions.UPDATE, lead, metadata=metadata)
    create_activity_event(
        business=lead.business,
        client=lead.client,
        actor=actor,
        event_type=event_type,
        instance=lead,
        text=text,
        metadata={"from": previous_status, "to": status},
    )
    notify_responsible(lead, text)
    return lead


def notify_responsible(lead: Lead, text: str, *, action_url=None):
    if not lead.responsible_user_id:
        return None
    return Notification.objects.create(
        business=lead.business,
        recipient=lead.responsible_user,
        client=lead.client,
        channel=Notification.Channels.SYSTEM,
        category=Notification.Categories.SALES,
        priority=Notification.Priorities.NORMAL,
        text=text,
        send_at=timezone.now(),
        status=Notification.Statuses.PENDING,
        action_url=action_url or f"/app/leads?lead={lead.id}",
        action_label="Открыть",
    )
