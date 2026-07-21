from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.businesses.assignment_notifications import create_assignment_notifications
from apps.businesses.assignment_policy import assert_assignment_allowed
from apps.businesses.access import Resources
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.tasks.models import Task
from apps.tasks.services import create_task_notification


@dataclass(frozen=True)
class LeadDealResult:
    deal: Deal
    created: bool


ALLOWED_LEAD_STATUS_TRANSITIONS = {
    Lead.Statuses.NEW: {Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS, Lead.Statuses.APPOINTMENT_CREATED, Lead.Statuses.CLOSED, Lead.Statuses.LOST},
    Lead.Statuses.CONTACTED: {Lead.Statuses.IN_PROGRESS, Lead.Statuses.APPOINTMENT_CREATED, Lead.Statuses.CLOSED, Lead.Statuses.LOST},
    Lead.Statuses.IN_PROGRESS: {Lead.Statuses.CONTACTED, Lead.Statuses.APPOINTMENT_CREATED, Lead.Statuses.CLOSED, Lead.Statuses.LOST},
    Lead.Statuses.APPOINTMENT_CREATED: {Lead.Statuses.IN_PROGRESS, Lead.Statuses.CLOSED, Lead.Statuses.LOST},
    Lead.Statuses.CLOSED: {Lead.Statuses.NEW, Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS},
    Lead.Statuses.LOST: {Lead.Statuses.NEW, Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS},
}
LEAD_LIFECYCLE_AUDIT_ACTIONS = {
    ActivityEvents.LEAD_TAKEN_IN_WORK: ActivityEvents.LEAD_TAKEN_IN_WORK,
    ActivityEvents.LEAD_CONTACTED: ActivityEvents.LEAD_CONTACTED,
    ActivityEvents.LEAD_CLOSED: ActivityEvents.LEAD_CLOSED,
    ActivityEvents.LEAD_LOST: ActivityEvents.LEAD_LOST,
    ActivityEvents.LEAD_REOPENED: ActivityEvents.LEAD_REOPENED,
    ActivityEvents.APPOINTMENT_CREATED: "lead_appointment_created",
}


def allowed_lead_status_transitions(status: str) -> set[str]:
    return set(ALLOWED_LEAD_STATUS_TRANSITIONS.get(status, set()))


def assign_lead(*, lead: Lead, actor, user_id=None, request=None) -> Lead:
    responsible_user_id = user_id or actor.id
    responsible_user = get_user_model().objects.filter(id=responsible_user_id, is_active=True).first()
    if responsible_user is None:
        raise ValidationError({"user_id": "User was not found."})
    assert_assignment_allowed(
        actor=actor,
        business=lead.business,
        target_user=responsible_user,
        resource=Resources.LEADS,
    )

    previous_responsible_user_id = lead.responsible_user_id
    previous_responsible_user = lead.responsible_user
    if previous_responsible_user_id == responsible_user.id:
        return lead
    lead.responsible_user = responsible_user
    lead.save(update_fields=["responsible_user", "updated_at"])
    if request is not None:
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            lead,
            metadata={
                "kind": "assignment",
                "event_type": ActivityEvents.LEAD_ASSIGNED,
                "from": previous_responsible_user_id,
                "to": responsible_user.id,
                "responsible_user": responsible_user.id,
            },
        )
    create_activity_event(
        business=lead.business,
        client=lead.client,
        actor=actor,
        event_type=ActivityEvents.LEAD_ASSIGNED,
        instance=lead,
        text="Ответственный по заявке обновлён",
        metadata={"from": previous_responsible_user_id, "to": responsible_user.id},
    )
    create_assignment_notifications(
        business=lead.business,
        previous_user=previous_responsible_user,
        new_user=responsible_user,
        text=f"Lead assigned: {lead.client}",
        action_url=f"/app/leads?lead={lead.id}",
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
    if lead.status == Lead.Statuses.LOST:
        raise ValidationError({"status": "Reopen lost lead before marking it contacted."})
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
    if lead.status not in {Lead.Statuses.LOST, Lead.Statuses.CLOSED}:
        raise ValidationError({"status": "Only lost or closed leads can be reopened."})
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


def convert_lead_to_client(*, lead: Lead, actor, request=None):
    if not lead.client_id:
        raise ValidationError({"client": "Lead does not have a linked client."})
    if lead.client.business_id != lead.business_id:
        raise ValidationError({"client": "Client must belong to lead business."})

    if request is not None:
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            lead,
            metadata={
                "kind": "conversion",
                "event_type": ActivityEvents.LEAD_CONVERTED_TO_CLIENT,
                "conversion": "lead_to_client",
                "client_id": lead.client_id,
            },
        )
    create_activity_event(
        business=lead.business,
        client=lead.client,
        actor=actor,
        event_type=ActivityEvents.LEAD_CONVERTED_TO_CLIENT,
        instance=lead,
        text="Заявка конвертирована в клиента",
        metadata={"client_id": lead.client_id},
    )
    return lead.client


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
    apply_lead_status(
        lead=lead,
        actor=actor,
        request=request,
        status=Lead.Statuses.IN_PROGRESS,
        event_type=ActivityEvents.LEAD_TAKEN_IN_WORK,
        text="Р—Р°СЏРІРєР° РІР·СЏС‚Р° РІ СЂР°Р±РѕС‚Сѓ РїРѕСЃР»Рµ СЃРѕР·РґР°РЅРёСЏ СЃРґРµР»РєРё",
    )
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


def apply_lead_status(
    *,
    lead: Lead,
    actor,
    status: str,
    event_type: str,
    text: str,
    request=None,
    lost_reason=None,
    clear_lost=False,
    service=None,
    source="api",
    activity_metadata=None,
) -> Lead:
    previous_status = lead.status
    previous_lost_reason = lead.lost_reason
    if previous_status != status and status not in allowed_lead_status_transitions(previous_status):
        raise ValidationError({"status": f"Cannot move lead from '{previous_status}' to '{status}'."})
    if service is not None and service.business_id != lead.business_id:
        raise ValidationError({"service": "Service must belong to lead business."})
    now = timezone.now()
    lead.status = status
    update_fields = ["status", "previous_status", "lost_reason", "lost_at", "lost_by", "updated_at"]
    if service is not None:
        lead.service = service
        update_fields.append("service")
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
    lead.save(update_fields=update_fields)
    if request is not None:
        metadata = {
            "kind": "lifecycle",
            "from": previous_status,
            "to": status,
            "event_type": event_type,
            "lifecycle_action": LEAD_LIFECYCLE_AUDIT_ACTIONS.get(event_type, f"lead_{status}"),
        }
        if activity_metadata:
            metadata.update(activity_metadata)
        if status == Lead.Statuses.LOST:
            metadata.update({"lost": True, "lost_reason": lead.lost_reason})
        if clear_lost and previous_lost_reason:
            metadata["cleared_lost_reason"] = previous_lost_reason
        write_audit_log(request, AuditLog.Actions.UPDATE, lead, metadata=metadata)
    event_metadata = {
        "from": previous_status,
        "to": status,
        "event_type": event_type,
        "lifecycle_action": LEAD_LIFECYCLE_AUDIT_ACTIONS.get(event_type, f"lead_{status}"),
    }
    if activity_metadata:
        event_metadata.update(activity_metadata)
    if status == Lead.Statuses.LOST:
        event_metadata["lost_reason"] = lead.lost_reason
    if clear_lost and previous_lost_reason:
        event_metadata["cleared_lost_reason"] = previous_lost_reason
    create_activity_event(
        business=lead.business,
        client=lead.client,
        actor=actor,
        event_type=event_type,
        instance=lead,
        source=source,
        text=text,
        metadata=event_metadata,
    )
    notify_responsible(lead, text)
    if previous_status != status:
        from apps.automations.engine import run_automations_for_event
        from apps.automations.models import AutomationRule

        run_automations_for_event(
            business=lead.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_STATUS_CHANGED,
            entity=lead,
            payload={
                "trigger_type": AutomationRule.TriggerTypes.LEAD_STATUS_CHANGED,
                "lead_id": lead.id,
                "from_status": previous_status,
                "to_status": status,
                "event_type": event_type,
            },
        )
    return lead


def can_mark_lead_appointment_created(lead: Lead) -> bool:
    return (
        lead.status == Lead.Statuses.APPOINTMENT_CREATED
        or Lead.Statuses.APPOINTMENT_CREATED in allowed_lead_status_transitions(lead.status)
    )


def mark_lead_appointment_created(
    *,
    lead: Lead,
    actor,
    service,
    request=None,
    appointment=None,
    resource=None,
    source="api",
    activity_metadata=None,
) -> Lead:
    if service.business_id != lead.business_id:
        raise ValidationError({"service": "Service must belong to lead business."})
    if resource and resource.business_id != lead.business_id:
        raise ValidationError({"resource": "Resource must belong to lead business."})
    if appointment is not None and appointment.business_id != lead.business_id:
        raise ValidationError({"appointment": "Appointment must belong to lead business."})
    if not can_mark_lead_appointment_created(lead):
        raise ValidationError(
            {"status": f"Cannot move lead from '{lead.status}' to '{Lead.Statuses.APPOINTMENT_CREATED}'."}
        )

    metadata = {
        "service_id": service.id,
        "appointment_id": appointment.id if appointment is not None else None,
        "resource_id": resource.id if resource is not None else None,
    }
    if activity_metadata:
        metadata.update(activity_metadata)

    if lead.status == Lead.Statuses.APPOINTMENT_CREATED:
        if lead.service_id != service.id:
            lead.service = service
            lead.save(update_fields=["service", "updated_at"])
        return lead

    return apply_lead_status(
        lead=lead,
        actor=actor,
        request=request,
        status=Lead.Statuses.APPOINTMENT_CREATED,
        event_type=ActivityEvents.APPOINTMENT_CREATED,
        text="Appointment created from lead.",
        service=service,
        source=source,
        activity_metadata=metadata,
    )


def create_appointment_from_lead_contract(*, lead: Lead, actor, service, start_at, resource=None, request=None):
    if service.business_id != lead.business_id:
        raise ValidationError({"service": "Service must belong to lead business."})
    if resource and resource.business_id != lead.business_id:
        raise ValidationError({"resource": "Resource must belong to lead business."})
    if lead.status != Lead.Statuses.APPOINTMENT_CREATED and Lead.Statuses.APPOINTMENT_CREATED not in allowed_lead_status_transitions(lead.status):
        raise ValidationError({"status": f"Cannot move lead from '{lead.status}' to '{Lead.Statuses.APPOINTMENT_CREATED}'."})

    from apps.scheduling.services import create_appointment_from_lead

    try:
        appointment = create_appointment_from_lead(
            lead,
            service,
            start_at,
            resource=resource,
            actor=actor,
            request=request,
            lead_activity_source="lead_api",
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    lead.refresh_from_db()

    create_activity_event(
        business=lead.business,
        client=lead.client,
        actor=actor,
        event_type=ActivityEvents.APPOINTMENT_CREATED,
        instance=appointment,
        text="Р—Р°РїРёСЃСЊ СЃРѕР·РґР°РЅР° РёР· Р·Р°СЏРІРєРё",
        metadata={"lead_id": lead.id, "to": lead.status},
    )
    if request is not None:
        write_audit_log(request, AuditLog.Actions.CREATE, appointment)
    notify_responsible(lead, "Р—Р°РїРёСЃСЊ СЃРѕР·РґР°РЅР° РёР· Р·Р°СЏРІРєРё", action_url=f"/app/calendar?appointment={appointment.id}")
    return appointment


def create_follow_up_task_from_lead(*, lead: Lead, actor, title: str, description: str = "", priority: str = Task.Priorities.NORMAL, due_at=None, assignee_id=None, request=None) -> Task:
    title = (title or "").strip()
    if not title:
        raise ValidationError({"title": "This field is required."})
    if priority not in Task.Priorities.values:
        raise ValidationError({"priority": "Invalid priority."})

    assignee = None
    if assignee_id:
        assignee = get_user_model().objects.filter(id=assignee_id, is_active=True).first()
        if assignee is None:
            raise ValidationError({"assignee": "User was not found."})
        if not lead.business.members.filter(user=assignee, is_active=True).exists():
            raise ValidationError({"assignee": "Assignee must be an active business member."})
    else:
        assignee = lead.responsible_user or actor
        if assignee and not lead.business.members.filter(user=assignee, is_active=True).exists():
            assignee = None

    task = Task.objects.create(
        business=lead.business,
        title=title,
        description=description or "",
        client=lead.client,
        lead=lead,
        assignee=assignee,
        created_by=actor,
        due_at=due_at,
        priority=priority,
    )
    if request is not None:
        write_audit_log(request, AuditLog.Actions.CREATE, task, metadata={"kind": "lead_follow_up", "lead_id": lead.id})
    create_activity_event(
        business=lead.business,
        client=lead.client,
        actor=actor,
        event_type=ActivityEvents.TASK_CREATED,
        instance=task,
        text="Р—Р°РґР°С‡Р° СЃРѕР·РґР°РЅР° РёР· Р·Р°СЏРІРєРё",
        metadata={"lead_id": lead.id},
    )
    if task.assignee_id:
        create_task_notification(task, f"РќРѕРІР°СЏ Р·Р°РґР°С‡Р° РїРѕ Р·Р°СЏРІРєРµ: {task.title}")
    return task


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
