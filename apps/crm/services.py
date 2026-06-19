from django.utils.text import slugify
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.businesses.models import Business
from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.crm.models import Deal, Pipeline, PipelineStage, StageTransition
from apps.core.audit import write_audit_log
from apps.core.custom_fields import required_custom_fields_missing
from apps.core.models import AuditLog


DEFAULT_STAGES = [
    ("New", "#06b6d4", 10, 60),
    ("Contacted", "#2563eb", 25, 240),
    ("Qualified", "#8b5cf6", 50, 480),
    ("Booked", "#22c55e", 80, None),
    ("Won", "#16a34a", 100, None),
    ("Lost", "#ef4444", 0, None),
]


def ensure_default_pipeline(business: Business) -> Pipeline:
    pipeline, _ = Pipeline.objects.get_or_create(
        business=business,
        slug="default-sales",
        defaults={
            "name": "Sales pipeline",
            "entity_type": Pipeline.EntityTypes.DEAL,
            "is_default": True,
            "template_key": "smb_default",
        },
    )
    for order, (name, color, probability, sla_minutes) in enumerate(DEFAULT_STAGES, start=1):
        PipelineStage.objects.get_or_create(
            business=business,
            pipeline=pipeline,
            name=name,
            defaults={
                "order": order,
                "color": color,
                "probability": probability,
                "sla_minutes": sla_minutes,
                "is_won": slugify(name) == "won",
                "is_lost": slugify(name) == "lost",
            },
        )
    return pipeline


def move_deal_stage(*, deal: Deal, stage: PipelineStage, actor, payload=None, source="api", request=None) -> Deal:
    payload = payload or {}
    validate_stage_requirements(deal=deal, stage=stage, actor=actor, payload=payload)
    return apply_deal_stage(deal=deal, stage=stage, actor=actor, payload=payload, source=source, request=request)


def mark_deal_won(*, deal: Deal, actor, amount=None, source="api", request=None) -> Deal:
    stage = get_terminal_stage(deal, is_won=True)
    if amount not in (None, ""):
        deal.amount = amount
    return apply_deal_stage(
        deal=deal,
        stage=stage,
        actor=actor,
        payload={"amount": amount} if amount not in (None, "") else {},
        event_type=ActivityEvents.DEAL_WON,
        activity_text="Сделка отмечена как оплаченная/успешная",
        source=source,
        request=request,
        audit_metadata={"lifecycle_action": "deal_won", "amount": str(amount) if amount not in (None, "") else ""},
    )


def mark_deal_lost(*, deal: Deal, actor, lost_reason: str, source="api", request=None) -> Deal:
    lost_reason = (lost_reason or "").strip()
    if not lost_reason:
        raise ValidationError({"lost_reason": "Reason is required when deal is lost."})
    stage = get_terminal_stage(deal, is_lost=True)
    return apply_deal_stage(
        deal=deal,
        stage=stage,
        actor=actor,
        payload={"lost_reason": lost_reason},
        event_type=ActivityEvents.DEAL_LOST,
        activity_text="Сделка закрыта как отказ",
        lost_reason=lost_reason,
        source=source,
        request=request,
        audit_metadata={"lifecycle_action": "deal_lost", "lost": True, "lost_reason": lost_reason},
    )


def reopen_deal(*, deal: Deal, actor, source="api", request=None) -> Deal:
    stage = get_reopen_stage(deal)
    return apply_deal_stage(
        deal=deal,
        stage=stage,
        actor=actor,
        payload={},
        event_type=ActivityEvents.DEAL_REOPENED,
        activity_text="Сделка возвращена в работу",
        source=source,
        request=request,
        audit_metadata={"lifecycle_action": "deal_reopened"},
    )


def apply_deal_stage(
    *,
    deal: Deal,
    stage: PipelineStage,
    actor,
    payload=None,
    event_type=ActivityEvents.DEAL_STAGE_CHANGED,
    activity_text=None,
    lost_reason=None,
    source="api",
    request=None,
    audit_metadata=None,
) -> Deal:
    payload = payload or {}
    previous_status = deal.status
    previous_stage = deal.stage
    now = timezone.now()

    deal.stage = stage
    deal.probability = stage.probability
    deal.stage_entered_at = now
    if stage.is_won:
        deal.status = Deal.Statuses.WON
        deal.won_at = deal.won_at or now
        deal.lost_at = None
        deal.lost_by = None
        deal.previous_status = previous_status if previous_status != Deal.Statuses.WON else ""
        deal.previous_stage = previous_stage if getattr(previous_stage, "id", None) else None
        deal.lost_reason = ""
    elif stage.is_lost:
        deal.status = Deal.Statuses.LOST
        deal.lost_at = deal.lost_at or now
        deal.lost_by = actor
        deal.previous_status = previous_status if previous_status != Deal.Statuses.LOST else ""
        deal.previous_stage = previous_stage if getattr(previous_stage, "id", None) else None
        deal.won_at = None
        deal.lost_reason = lost_reason if lost_reason is not None else payload.get("lost_reason", deal.lost_reason)
    else:
        deal.status = Deal.Statuses.OPEN
        deal.won_at = None
        deal.lost_at = None
        deal.lost_by = None
        deal.previous_status = ""
        deal.previous_stage = None
        deal.lost_reason = ""
    deal.save(
        update_fields=[
            "stage",
            "probability",
            "stage_entered_at",
            "status",
            "amount",
            "won_at",
            "lost_at",
            "lost_by",
            "lost_reason",
            "previous_status",
            "previous_stage",
            "updated_at",
        ]
    )
    create_activity_event(
        business=deal.business,
        client=deal.client,
        actor=actor,
        event_type=event_type,
        instance=deal,
        source=source,
        text=activity_text or f"Сделка перешла на стадию: {stage.name}",
        metadata={
            "from_status": previous_status,
            "to_status": deal.status,
            "from_stage": previous_stage.id if previous_stage else None,
            "to_stage": stage.id,
        },
    )
    if request is not None and audit_metadata is not None:
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            deal,
            metadata={
                "kind": "lifecycle",
                "from_status": previous_status,
                "to_status": deal.status,
                "from_stage": previous_stage.id if previous_stage else None,
                "to_stage": stage.id,
                **audit_metadata,
            },
        )
    return deal


def get_terminal_stage(deal: Deal, *, is_won=False, is_lost=False) -> PipelineStage:
    query = PipelineStage.objects.filter(business=deal.business, pipeline=deal.pipeline)
    if is_won:
        query = query.filter(is_won=True)
    if is_lost:
        query = query.filter(is_lost=True)
    stage = query.order_by("order", "id").first()
    if not stage:
        raise ValidationError({"stage": "Terminal stage is not configured for this pipeline."})
    return stage


def get_reopen_stage(deal: Deal) -> PipelineStage:
    if deal.previous_stage_id and not (deal.previous_stage.is_won or deal.previous_stage.is_lost):
        return deal.previous_stage
    stage = (
        PipelineStage.objects.filter(
            business=deal.business,
            pipeline=deal.pipeline,
            is_won=False,
            is_lost=False,
        )
        .order_by("order", "id")
        .first()
    )
    if not stage:
        raise ValidationError({"stage": "Open stage is not configured for this pipeline."})
    return stage


def validate_stage_requirements(*, deal: Deal, stage: PipelineStage, actor, payload=None) -> None:
    payload = payload or {}
    if stage.business_id != deal.business_id or stage.pipeline_id != deal.pipeline_id:
        raise ValidationError({"stage": "Stage does not exist in this deal pipeline."})

    transition = StageTransition.objects.filter(
        business=deal.business,
        pipeline=deal.pipeline,
        from_stage=deal.stage,
        to_stage=stage,
        is_active=True,
    ).first()
    if transition and transition.required_permission:
        allowed_roles = set(stage.allowed_roles_json.get("roles", []))
        if allowed_roles and actor.role not in allowed_roles:
            raise ValidationError({"stage": "Your role cannot move deals to this stage."})

    allowed_roles = set(stage.allowed_roles_json.get("roles", []))
    if allowed_roles and actor.role not in allowed_roles:
        raise ValidationError({"stage": "Your role cannot move deals to this stage."})

    missing = []
    for field in stage.required_fields_json.get("fields", []):
        value = payload.get(field, getattr(deal, field, None))
        if value in (None, "", 0, "0"):
            missing.append(field)
    if stage.is_lost and not payload.get("lost_reason") and "lost_reason" not in missing:
        missing.append("lost_reason")
    missing_custom_fields = required_custom_fields_missing(
        business=deal.business,
        entity_type="deal",
        entity_id=deal.id,
        required=stage.required_fields_json.get("custom_fields", []),
    )
    if missing or missing_custom_fields:
        errors = {}
        if missing:
            errors["required_fields"] = missing
        if missing_custom_fields:
            errors["required_custom_fields"] = missing_custom_fields
        raise ValidationError(errors)
