from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Max, Q, Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.ai_core.models import AIRequestLog
from apps.billing.models import Subscription
from apps.billing.usage import usage_summary
from apps.bots.models import Bot, BotChannel, BotConversation
from apps.businesses.activation import activate_landing_business
from apps.businesses.models import Business
from apps.clients.models import Client
from apps.businesses.serializers import ActivateLandingBusinessSerializer
from apps.core.models import AuditLog
from apps.core.operations_health import platform_operations_health
from apps.core.permissions import IsPlatformUser
from apps.integrations.models import BusinessConnector, BusinessEvent
from apps.leads.models import Lead, LeadForm, LeadFormSubmissionError
from apps.notifications.models import Notification
from apps.tasks.models import Task


def _merchant_counts(business):
    lead_count = Lead.objects.filter(business=business, is_archived=False).count()
    new_leads = Lead.objects.filter(business=business, status=Lead.Statuses.NEW, is_archived=False).count()
    clients_count = Client.objects.filter(business=business, is_archived=False).count()
    open_tasks = Task.objects.filter(
        business=business,
        is_archived=False,
        status__in=[Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS],
    ).count()
    unread_conversations = BotConversation.objects.filter(
        business=business,
        is_archived=False,
        unread_count__gt=0,
    ).count()
    handoff_conversations = BotConversation.objects.filter(
        business=business,
        is_archived=False,
        handoff_required=True,
    ).count()
    failed_connectors = BusinessConnector.objects.filter(
        business=business,
        status__in=[BusinessConnector.Statuses.FAILED, BusinessConnector.Statuses.EXPIRED_CREDENTIALS],
    ).count()
    pending_connectors = BusinessConnector.objects.filter(
        business=business,
        status=BusinessConnector.Statuses.NEEDS_ATTENTION,
    ).count()
    connected_connectors = BusinessConnector.objects.filter(
        business=business,
        status__in=[BusinessConnector.Statuses.CONNECTED, BusinessConnector.Statuses.SYNCING],
    ).count()
    form_errors = LeadFormSubmissionError.objects.filter(business=business).count()
    lead_forms = LeadForm.objects.filter(business=business, is_active=True).count()
    sales_events = BusinessEvent.objects.filter(business=business, event_type__in=["sale.recorded", "sale_recorded"]).count()
    latest_activity = max(
        [value for value in [
            Lead.objects.filter(business=business).aggregate(value=Max("updated_at"))["value"],
            BotConversation.objects.filter(business=business).aggregate(value=Max("updated_at"))["value"],
            BusinessEvent.objects.filter(business=business).aggregate(value=Max("created_at"))["value"],
            Task.objects.filter(business=business).aggregate(value=Max("updated_at"))["value"],
        ] if value],
        default=business.updated_at,
    )
    return {
        "lead_count": lead_count,
        "new_leads": new_leads,
        "clients_count": clients_count,
        "open_tasks": open_tasks,
        "unread_conversations": unread_conversations,
        "handoff_conversations": handoff_conversations,
        "failed_connectors": failed_connectors,
        "pending_connectors": pending_connectors,
        "connected_connectors": connected_connectors,
        "form_errors": form_errors,
        "lead_forms": lead_forms,
        "sales_events": sales_events,
        "latest_activity_at": latest_activity,
    }


def _merchant_health(business, counts, subscription=None):
    checks = {
        "has_owner": bool(business.owner_id),
        "has_landing": bool(business.landing_id or business.landing_domain),
        "has_lead_form": counts["lead_forms"] > 0,
        "has_leads": counts["lead_count"] > 0,
        "has_sales_data": counts["sales_events"] > 0,
        "has_connected_source": counts["connected_connectors"] > 0 or counts["pending_connectors"] > 0,
        "has_subscription": bool(subscription),
    }
    score = round((sum(1 for value in checks.values() if value) / len(checks)) * 100)
    blockers = []
    if not checks["has_lead_form"]:
        blockers.append("Нет активной формы заявок")
    if counts["form_errors"]:
        blockers.append(f"Ошибки формы заявок: {counts['form_errors']}")
    if counts["failed_connectors"]:
        blockers.append(f"Интеграции требуют внимания: {counts['failed_connectors']}")
    if not checks["has_sales_data"]:
        blockers.append("Нет загруженных продаж")
    if counts["handoff_conversations"]:
        blockers.append(f"Диалоги ждут оператора: {counts['handoff_conversations']}")

    if blockers:
        status = "attention"
    elif score >= 75:
        status = "healthy"
    elif score >= 45:
        status = "setup"
    else:
        status = "risk"

    if blockers:
        next_action = blockers[0]
    elif counts["new_leads"]:
        next_action = "Проверить новые заявки"
    elif not checks["has_sales_data"]:
        next_action = "Загрузить продажи Excel/CSV"
    else:
        next_action = "Мониторить активность пилота"

    return {
        "score": score,
        "status": status,
        "checks": checks,
        "blockers": blockers[:5],
        "next_action": next_action,
    }


def _merchant_support_workflow(business, counts, health):
    priority = "low"
    if health["status"] == "risk" or counts["failed_connectors"] or counts["form_errors"]:
        priority = "high"
    elif health["status"] == "attention" or counts["handoff_conversations"] or counts["new_leads"] or counts["pending_connectors"]:
        priority = "medium"

    next_steps = []
    if counts["form_errors"]:
        next_steps.append({"key": "fix_forms", "label": "Проверить ошибки формы", "href": f"/platform/merchants/{business.id}"})
    if counts["handoff_conversations"]:
        next_steps.append({"key": "answer_inbox", "label": "Помочь с диалогами handoff", "href": "/dashboard/inbox"})
    if counts["failed_connectors"]:
        next_steps.append({"key": "fix_connectors", "label": "Проверить failed connectors", "href": "/dashboard/integrations"})
    if counts["pending_connectors"]:
        next_steps.append({"key": "review_connection_requests", "label": "Проверить заявки на подключение", "href": f"/platform/merchants/{business.id}"})
    if not health["checks"].get("has_sales_data"):
        next_steps.append({"key": "request_sales_upload", "label": "Попросить клиента загрузить Excel/CSV продаж", "href": "/dashboard/settings#data-tools"})
    if counts["new_leads"]:
        next_steps.append({"key": "check_new_leads", "label": "Проверить новые заявки", "href": "/dashboard/leads"})
    if not next_steps:
        next_steps.append({"key": "monitor", "label": "Мониторить пилот и активность", "href": f"/platform/merchants/{business.id}"})

    recent_actions = [
        {
            "id": log.id,
            "action_type": log.metadata.get("action_type", "support_note"),
            "note": log.metadata.get("note", ""),
            "status": log.metadata.get("status", "logged"),
            "created_at": log.created_at,
            "actor_email": log.actor.email if log.actor else None,
        }
        for log in AuditLog.objects.filter(business=business, entity_type="platform_support_action").select_related("actor")[:5]
    ]
    return {
        "priority": priority,
        "summary": health["next_action"],
        "next_steps": next_steps[:5],
        "recent_actions": recent_actions,
    }


def _platform_operations_summary(since):
    businesses = Business.objects.all()
    total = businesses.count()
    attention = 0
    risk = 0
    no_sales_data = 0
    with_form_errors = 0
    handoff = 0
    for business in businesses.select_related("owner")[:500]:
        subscription = getattr(business, "subscription", None)
        counts = _merchant_counts(business)
        health = _merchant_health(business, counts, subscription=subscription)
        attention += 1 if health["status"] == "attention" else 0
        risk += 1 if health["status"] == "risk" else 0
        no_sales_data += 1 if not health["checks"]["has_sales_data"] else 0
        with_form_errors += 1 if counts["form_errors"] else 0
        handoff += counts["handoff_conversations"]
    return {
        "total_monitored": total,
        "attention_merchants": attention,
        "risk_merchants": risk,
        "no_sales_data_merchants": no_sales_data,
        "form_error_merchants": with_form_errors,
        "handoff_conversations": handoff,
        "new_leads_30d": Lead.objects.filter(created_at__gte=since, is_archived=False).count(),
        "form_errors_30d": LeadFormSubmissionError.objects.filter(created_at__gte=since).count(),
        "failed_connectors": BusinessConnector.objects.filter(status__in=[BusinessConnector.Statuses.FAILED, BusinessConnector.Statuses.EXPIRED_CREDENTIALS]).count(),
    }


@api_view(["GET"])
@permission_classes([IsPlatformUser])
def platform_overview(request):
    since = timezone.now() - timedelta(days=30)
    active_subscriptions = Subscription.objects.filter(status=Subscription.Statuses.ACTIVE)
    mrr = active_subscriptions.aggregate(total=Sum("plan__monthly_price"))["total"] or 0

    return Response(
        {
            "total_businesses": Business.objects.count(),
            "active_businesses": Business.objects.filter(status=Business.Statuses.ACTIVE).count(),
            "trial_businesses": Business.objects.filter(status=Business.Statuses.TRIAL).count(),
            "active_subscriptions": active_subscriptions.count(),
            "mrr_estimate": str(mrr),
            "total_users": get_user_model().objects.count(),
            "bot_count": Bot.objects.count(),
            "active_bot_channels": BotChannel.objects.filter(status=BotChannel.Statuses.ACTIVE).count(),
            "ai_requests_30d": AIRequestLog.objects.filter(created_at__gte=since).count(),
            "conversations_30d": BotConversation.objects.filter(created_at__gte=since).count(),
            "operations_summary": _platform_operations_summary(since),
            "errors": {"count": 0, "items": []},
        }
    )


@api_view(["GET"])
@permission_classes([IsPlatformUser])
def platform_operations_health_view(request):
    return Response(platform_operations_health())


@api_view(["GET"])
@permission_classes([IsPlatformUser])
def platform_merchants(request):
    businesses = (
        Business.objects.select_related("owner", "subscription", "subscription__plan")
        .order_by("-created_at", "name")
    )
    data = []

    for business in businesses:
        subscription = getattr(business, "subscription", None)
        plan = subscription.plan if subscription else None
        counts = _merchant_counts(business)
        health = _merchant_health(business, counts, subscription=subscription)
        data.append(
            {
                "id": business.id,
                "name": business.name,
                "status": business.status,
                "created_at": business.created_at,
                "owner": {
                    "id": business.owner_id,
                    "email": business.owner.email,
                    "full_name": business.owner.full_name,
                },
                "plan": {
                    "id": plan.id,
                    "name": plan.name,
                    "code": plan.code,
                    "monthly_price": str(plan.monthly_price),
                }
                if plan
                else None,
                "subscription_status": subscription.status if subscription else None,
                "usage_summary": usage_summary(business),
                "operations": counts,
                "health": health,
                "support_workflow": _merchant_support_workflow(business, counts, health),
                "latest_activity_at": counts["latest_activity_at"],
            }
        )

    return Response(data)


@api_view(["GET"])
@permission_classes([IsPlatformUser])
def platform_merchant_detail(request, business_id):
    try:
        business = Business.objects.select_related("owner", "subscription", "subscription__plan").get(id=business_id)
    except Business.DoesNotExist:
        return Response({"detail": "Merchant not found."}, status=404)

    subscription = getattr(business, "subscription", None)
    counts = _merchant_counts(business)
    health = _merchant_health(business, counts, subscription=subscription)
    return Response(
        {
            "id": business.id,
            "name": business.name,
            "status": business.status,
            "landing_id": business.landing_id,
            "landing_domain": business.landing_domain,
            "owner": {
                "id": business.owner_id,
                "email": business.owner.email if business.owner else "",
                "full_name": business.owner.full_name if business.owner else "",
            },
            "operations": counts,
            "health": health,
            "support_workflow": _merchant_support_workflow(business, counts, health),
        }
    )


@api_view(["POST"])
@permission_classes([IsPlatformUser])
def platform_merchant_support_action(request, business_id):
    try:
        business = Business.objects.get(id=business_id)
    except Business.DoesNotExist:
        return Response({"detail": "Merchant not found."}, status=404)

    action_type = (request.data.get("action_type") or "support_note").strip()[:64]
    note = (request.data.get("note") or "").strip()
    status = (request.data.get("status") or "logged").strip()[:32]
    if not note:
        return Response({"note": ["This field is required."]}, status=400)

    log = AuditLog.objects.create(
        business=business,
        actor=request.user,
        action=AuditLog.Actions.UPDATE,
        category=AuditLog.Categories.SYSTEM,
        risk_level=AuditLog.RiskLevels.LOW,
        entity_type="platform_support_action",
        entity_id=str(business.id),
        metadata={"action_type": action_type, "note": note, "status": status},
    )
    return Response(
        {
            "id": log.id,
            "business_id": business.id,
            "action_type": action_type,
            "note": note,
            "status": status,
            "created_at": log.created_at,
            "actor_email": request.user.email,
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsPlatformUser])
def platform_activate_landing(request):
    serializer = ActivateLandingBusinessSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = activate_landing_business(
        landing_id=serializer.validated_data["landing_id"],
        owner_email=serializer.validated_data["owner_email"],
        owner_password=serializer.validated_data.get("owner_password") or None,
        owner_full_name=serializer.validated_data.get("owner_full_name", ""),
        business_name=serializer.validated_data["business_name"],
        business_type=serializer.validated_data.get("business_type", Business.BusinessTypes.OTHER),
        landing_domain=serializer.validated_data.get("landing_domain", ""),
        landing_preview_url=serializer.validated_data.get("landing_preview_url", ""),
        city=serializer.validated_data.get("city", ""),
        phone=serializer.validated_data.get("phone", ""),
    )
    return Response(
        {
            "business": {
                "id": result.business.id,
                "name": result.business.name,
                "slug": result.business.slug,
                "status": result.business.status,
                "landing_id": result.business.landing_id,
                "landing_domain": result.business.landing_domain,
                "landing_preview_url": result.business.landing_preview_url,
            },
            "owner": {
                "id": result.owner.id,
                "email": result.owner.email,
                "full_name": result.owner.full_name,
            },
            "subscription": {
                "id": result.subscription.id,
                "status": result.subscription.status,
                "plan": result.subscription.plan.code,
                "next_payment_at": result.subscription.next_payment_at,
            },
            "lead_form": {
                "id": result.lead_form.id,
                "public_id": result.lead_form.public_id,
                "landing_id": result.lead_form.landing_id,
            },
            "pipeline": {
                "id": result.pipeline.id,
                "name": result.pipeline.name,
                "stages_count": result.pipeline.stages.count(),
            },
            "created_owner": result.created_owner,
            "created_business": result.created_business,
        },
        status=201 if result.created_business else 200,
    )
