from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.billing.models import Subscription, SubscriptionPlan
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.crm.models import Pipeline, PipelineStage
from apps.leads.models import Lead, LeadForm, LeadFormField


PILOT_STAGE_SPECS = [
    ("Новая заявка", "#06b6d4", 10, 60, False, False),
    ("Связались", "#2563eb", 25, 240, False, False),
    ("Записан / в работе", "#8b5cf6", 60, 480, False, False),
    ("Оплатил / закрыт", "#16a34a", 100, None, True, False),
    ("Не дозвонились", "#f59e0b", 0, 120, False, True),
    ("Отказ", "#ef4444", 0, None, False, True),
]


@dataclass(frozen=True)
class ActivationResult:
    business: Business
    owner: object
    subscription: Subscription
    lead_form: LeadForm
    pipeline: Pipeline
    created_owner: bool
    created_business: bool


@transaction.atomic
def activate_landing_business(
    *,
    landing_id: str,
    owner_email: str,
    business_name: str,
    owner_password: str | None = None,
    owner_full_name: str = "",
    business_type: str = Business.BusinessTypes.OTHER,
    landing_domain: str = "",
    landing_preview_url: str = "",
    city: str = "",
    phone: str = "",
) -> ActivationResult:
    landing_id = str(landing_id or "").strip()
    owner_email = str(owner_email or "").strip().lower()
    business_name = str(business_name or "").strip()
    if not landing_id:
        raise ValueError("landing_id is required.")
    if not owner_email:
        raise ValueError("owner_email is required.")
    if not business_name:
        raise ValueError("business_name is required.")

    owner, created_owner = _get_or_create_owner(owner_email, owner_password=owner_password, full_name=owner_full_name)
    business, created_business = _get_or_create_business(
        owner=owner,
        landing_id=landing_id,
        business_name=business_name,
        business_type=business_type,
        landing_domain=landing_domain,
        landing_preview_url=landing_preview_url,
        city=city,
        phone=phone,
    )
    owner_membership = _ensure_owner_membership(business, owner)
    pipeline = ensure_pilot_pipeline(business)
    lead_form = ensure_landing_lead_form(business, landing_id=landing_id, landing_domain=landing_domain, owner=owner)
    subscription = ensure_trial_subscription(business)

    return ActivationResult(
        business=business,
        owner=owner,
        subscription=subscription,
        lead_form=lead_form,
        pipeline=pipeline,
        created_owner=created_owner,
        created_business=created_business,
    )


def ensure_pilot_pipeline(business: Business) -> Pipeline:
    pipeline, _ = Pipeline.objects.get_or_create(
        business=business,
        slug="pilot-crm-light",
        defaults={
            "name": "CRM Light",
            "entity_type": Pipeline.EntityTypes.DEAL,
            "is_default": True,
            "template_key": f"pilot_{business.business_type}",
        },
    )
    if not pipeline.is_default:
        pipeline.is_default = True
        pipeline.template_key = f"pilot_{business.business_type}"
        pipeline.save(update_fields=["is_default", "template_key", "updated_at"])

    for order, (name, color, probability, sla_minutes, is_won, is_lost) in enumerate(PILOT_STAGE_SPECS, start=1):
        stage, created = PipelineStage.objects.get_or_create(
            business=business,
            pipeline=pipeline,
            name=name,
            defaults={
                "order": order,
                "color": color,
                "probability": probability,
                "sla_minutes": sla_minutes,
                "is_won": is_won,
                "is_lost": is_lost,
            },
        )
        if not created:
            stage.order = order
            stage.color = color
            stage.probability = probability
            stage.sla_minutes = sla_minutes
            stage.is_won = is_won
            stage.is_lost = is_lost
            stage.save(update_fields=["order", "color", "probability", "sla_minutes", "is_won", "is_lost", "updated_at"])
    return pipeline


def ensure_landing_lead_form(business: Business, *, landing_id: str, landing_domain: str = "", owner=None) -> LeadForm:
    form = business.lead_forms.filter(landing_id=landing_id).first()
    if form is None:
        form = LeadForm.objects.create(
            business=business,
            name="Landing lead form",
            title="Оставить заявку",
            description="Заявки из внешнего лендинга автоматически попадают в CRM Light.",
            source=Lead.Sources.LANDING,
            landing_id=landing_id,
            landing_domain=landing_domain or business.landing_domain,
            default_responsible_user=owner or business.owner,
        )
    else:
        form.source = Lead.Sources.LANDING
        form.landing_domain = landing_domain or form.landing_domain or business.landing_domain
        form.default_responsible_user = form.default_responsible_user or owner or business.owner
        form.is_active = True
        form.save(update_fields=["source", "landing_domain", "default_responsible_user", "is_active", "updated_at"])

    fields = [
        ("full_name", "Имя", LeadFormField.FieldTypes.TEXT, False, 1),
        ("phone", "Телефон", LeadFormField.FieldTypes.PHONE, True, 2),
        ("email", "Email", LeadFormField.FieldTypes.EMAIL, False, 3),
        ("message", "Комментарий", LeadFormField.FieldTypes.TEXTAREA, False, 4),
    ]
    for key, label, field_type, is_required, sort_order in fields:
        LeadFormField.objects.get_or_create(
            form=form,
            key=key,
            defaults={"label": label, "field_type": field_type, "is_required": is_required, "sort_order": sort_order},
        )
    return form


def ensure_trial_subscription(business: Business, *, days: int = 30) -> Subscription:
    plan = _trial_plan()
    now = timezone.now()
    subscription, _ = Subscription.objects.get_or_create(
        business=business,
        defaults={
            "plan": plan,
            "status": Subscription.Statuses.TRIAL,
            "started_at": now,
            "next_payment_at": now + timezone.timedelta(days=days),
        },
    )
    subscription.plan = plan
    subscription.status = Subscription.Statuses.TRIAL
    subscription.started_at = subscription.started_at or now
    subscription.next_payment_at = subscription.next_payment_at or now + timezone.timedelta(days=days)
    subscription.cancelled_at = None
    subscription.save(update_fields=["plan", "status", "started_at", "next_payment_at", "cancelled_at", "updated_at"])
    return subscription


def _get_or_create_owner(email: str, *, owner_password: str | None, full_name: str):
    User = get_user_model()
    username = _unique_username(email.split("@")[0] or "owner")
    owner, created = User.objects.get_or_create(
        email=email,
        defaults={
            "username": username,
            "role": User.Roles.BUSINESS_OWNER,
            "full_name": full_name,
            "is_active": True,
        },
    )
    owner.role = User.Roles.BUSINESS_OWNER
    owner.full_name = full_name or owner.full_name
    owner.is_active = True
    if owner_password:
        owner.set_password(owner_password)
    elif created:
        owner.set_unusable_password()
    owner.save(update_fields=["role", "full_name", "is_active", "password"])
    return owner, created


def _get_or_create_business(*, owner, landing_id, business_name, business_type, landing_domain, landing_preview_url, city, phone):
    business = Business.objects.filter(landing_id=landing_id).first()
    created = False
    if business is None:
        business = Business.objects.create(
            owner=owner,
            name=business_name,
            slug=_unique_business_slug(business_name),
            business_type=business_type if business_type in Business.BusinessTypes.values else Business.BusinessTypes.OTHER,
            status=Business.Statuses.TRIAL,
            landing_id=landing_id,
            landing_domain=landing_domain,
            landing_preview_url=landing_preview_url,
            city=city,
            phone=phone,
        )
        created = True
    else:
        business.owner = owner
        business.name = business_name or business.name
        business.business_type = business_type if business_type in Business.BusinessTypes.values else business.business_type
        business.status = Business.Statuses.TRIAL
        business.landing_domain = landing_domain or business.landing_domain
        business.landing_preview_url = landing_preview_url or business.landing_preview_url
        business.city = city or business.city
        business.phone = phone or business.phone
        business.save(update_fields=["owner", "name", "business_type", "status", "landing_domain", "landing_preview_url", "city", "phone", "updated_at"])
    ensure_default_roles(business)
    return business, created


def _ensure_owner_membership(business, owner):
    role = BusinessRole.objects.filter(business=business, preset_key=BusinessMember.Roles.OWNER).first()
    membership, _ = BusinessMember.objects.update_or_create(
        business=business,
        user=owner,
        defaults={"role": BusinessMember.Roles.OWNER, "business_role": role, "is_active": True},
    )
    return membership


def _trial_plan():
    plan = SubscriptionPlan.objects.filter(code="growth", is_active=True).first()
    if plan:
        return plan
    plan = SubscriptionPlan.objects.filter(is_active=True).order_by("monthly_price", "name").first()
    if plan:
        return plan
    return SubscriptionPlan.objects.create(
        name="Growth",
        code="growth",
        monthly_price=0,
        description="Default pilot trial plan.",
        limits_json={},
        features_json={"features": ["CRM Light", "Lead capture", "Trial access"]},
    )


def _unique_business_slug(name):
    base = slugify(name) or "business"
    slug = base
    index = 2
    while Business.objects.filter(slug=slug).exists():
        slug = f"{base}-{index}"
        index += 1
    return slug


def _unique_username(base):
    User = get_user_model()
    slug = slugify(base) or "owner"
    username = slug
    index = 2
    while User.objects.filter(username=username).exists():
        username = f"{slug}-{index}"
        index += 1
    return username
