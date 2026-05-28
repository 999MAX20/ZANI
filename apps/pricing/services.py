from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.integrations.models import BusinessEvent
from apps.notifications.models import Notification
from apps.pricing.models import KaspiCompetitorOffer, KaspiPriceChangeLog, KaspiPricingAlert, KaspiPricingControl, KaspiPricingRecommendation, KaspiPricingRule, PricingCatalogItem
from apps.pricing.providers import get_competitor_price_provider
from apps.pricing.write_adapters import get_kaspi_price_write_adapter


PRICING_CATALOG_EVENT_TYPES = {
    "catalog.item_created",
    "catalog.item_imported",
    "kaspi_product_activity",
    "moysklad_product_imported",
    "moysklad_stock_imported",
    "product_imported",
    "stock_imported",
    "ozon_stock_imported",
    "wildberries_stock_imported",
}


def calculate_kaspi_target_price(rule, competitor_price=None):
    competitor = _decimal_or_none(competitor_price)
    current_price = Decimal(rule.current_price)
    min_price = Decimal(rule.min_price)
    step = Decimal(rule.step_amount or Decimal("1.00"))

    if competitor is None:
        return {
            "status": KaspiPricingRecommendation.Statuses.BLOCKED,
            "target_price": current_price,
            "competitor_price": None,
            "reason": "Нет цены конкурента для расчета.",
            "decision": {"guardrail": "missing_competitor_price"},
        }

    desired = competitor - step
    if desired < min_price:
        target = min_price
        if current_price <= min_price:
            return {
                "status": KaspiPricingRecommendation.Statuses.BLOCKED,
                "target_price": current_price,
                "competitor_price": competitor,
                "reason": "Конкурент ниже порога. Снижение заблокировано минимальной ценой.",
                "decision": {"guardrail": "min_price", "desired_price": str(desired), "min_price": str(min_price)},
            }
        return {
            "status": KaspiPricingRecommendation.Statuses.PROPOSED,
            "target_price": target,
            "competitor_price": competitor,
            "reason": "Снизить до минимально разрешенной цены. Ниже порога ZANI не опускается.",
            "decision": {"guardrail": "min_price", "desired_price": str(desired), "min_price": str(min_price)},
        }

    if desired >= current_price:
        return {
            "status": KaspiPricingRecommendation.Statuses.BLOCKED,
            "target_price": current_price,
            "competitor_price": competitor,
            "reason": "Текущая цена уже не выше безопасной целевой цены.",
            "decision": {"guardrail": "no_decrease_needed", "desired_price": str(desired)},
        }

    return {
        "status": KaspiPricingRecommendation.Statuses.PROPOSED,
        "target_price": desired,
        "competitor_price": competitor,
        "reason": f"Снизить на {step} ₸ ниже ближайшего конкурента.",
        "decision": {"guardrail": "competitor_minus_step", "step": str(step)},
    }


def create_kaspi_recommendation(rule, competitor_price=None, competitor_name="", observed_payload=None):
    with transaction.atomic():
        if competitor_price not in (None, ""):
            KaspiCompetitorOffer.objects.create(
                business=rule.business,
                rule=rule,
                competitor_name=competitor_name or "Конкурент",
                price=competitor_price,
                position=1,
                payload_json=observed_payload or {},
            )
        elif competitor_price in (None, ""):
            latest_offer = rule.competitor_offers.filter(available=True).order_by("price", "-observed_at").first()
            if latest_offer:
                competitor_price = latest_offer.price
                competitor_name = latest_offer.competitor_name

        result = calculate_kaspi_target_price(rule, competitor_price=competitor_price)
        target = result["target_price"]
        recommendation = KaspiPricingRecommendation.objects.create(
            business=rule.business,
            rule=rule,
            current_price=rule.current_price,
            competitor_price=result["competitor_price"],
            target_price=target,
            min_price=rule.min_price,
            delta=Decimal(target) - Decimal(rule.current_price),
            reason=result["reason"],
            status=result["status"],
            decision_json={**result["decision"], "competitor_name": competitor_name or ""},
        )
        rule.last_checked_at = timezone.now()
        rule.last_recommended_price = target
        rule.last_error = "" if recommendation.status != KaspiPricingRecommendation.Statuses.BLOCKED else recommendation.reason
        rule.save(update_fields=["last_checked_at", "last_recommended_price", "last_error", "updated_at"])
        return recommendation


def apply_kaspi_recommendation(recommendation, user=None, force=False):
    rule = recommendation.rule
    control = get_pricing_control(rule.business)
    if control.emergency_stop_enabled:
        return _blocked_change(rule, recommendation, user, "Emergency stop включен для ценового агента.")
    if recommendation.status not in {KaspiPricingRecommendation.Statuses.PROPOSED, KaspiPricingRecommendation.Statuses.APPROVED}:
        return _blocked_change(rule, recommendation, user, "Рекомендация не готова к применению.")
    if recommendation.target_price < rule.min_price:
        return _blocked_change(rule, recommendation, user, "Целевая цена ниже минимального порога.")
    if _changes_today(rule) >= rule.max_changes_per_day and not force:
        return _blocked_change(rule, recommendation, user, "Достигнут дневной лимит изменений цены.")
    if rule.status != KaspiPricingRule.Statuses.ACTIVE:
        return _blocked_change(rule, recommendation, user, "Правило не активно.")

    write_enabled = bool(settings.KASPI_REPRICING_ENABLED and settings.KASPI_REPRICING_WRITE_ENABLED)
    status = KaspiPriceChangeLog.Statuses.QUEUED if write_enabled else KaspiPriceChangeLog.Statuses.SIMULATED
    provider_response = {
        "write_enabled": write_enabled,
        "note": "Real Kaspi price write-back is disabled; change is simulated." if not write_enabled else "Queued for provider write-back.",
    }
    change = KaspiPriceChangeLog.objects.create(
        business=rule.business,
        rule=rule,
        recommendation=recommendation,
        old_price=rule.current_price,
        new_price=recommendation.target_price,
        status=status,
        mode=rule.mode,
        provider_response_json=provider_response,
        created_by=user,
    )
    if write_enabled:
        result = get_kaspi_price_write_adapter().update_price(change)
        change.status = KaspiPriceChangeLog.Statuses.QUEUED if result.ok and result.status == "queued" else KaspiPriceChangeLog.Statuses.FAILED
        change.provider_response_json = {**provider_response, **result.payload}
        change.error = result.error
        change.save(update_fields=["status", "provider_response_json", "error"])
        if not result.ok:
            create_pricing_alert(
                business=rule.business,
                rule=rule,
                change_log=change,
                alert_type=KaspiPricingAlert.Types.WRITE_FAILED,
                severity=KaspiPricingAlert.Severities.CRITICAL,
                title="Не удалось отправить цену в Kaspi",
                message=result.error,
            )
            recommendation.status = KaspiPricingRecommendation.Statuses.FAILED
            recommendation.save(update_fields=["status", "updated_at"])
            return change
    rule.current_price = recommendation.target_price
    rule.last_applied_price = recommendation.target_price
    rule.last_error = ""
    rule.save(update_fields=["current_price", "last_applied_price", "last_error", "updated_at"])
    recommendation.status = KaspiPricingRecommendation.Statuses.APPROVED
    recommendation.save(update_fields=["status", "updated_at"])
    return change


def run_kaspi_pricing_cycle(business_id=None, apply_autopilot=False, user=None):
    rules = KaspiPricingRule.objects.filter(status=KaspiPricingRule.Statuses.ACTIVE).select_related("business")
    if business_id:
        rules = rules.filter(business_id=business_id)

    summary = {
        "rules_checked": 0,
        "recommendations_created": 0,
        "blocked": 0,
        "autopilot_applied": 0,
        "autopilot_blocked": 0,
        "offers_collected": 0,
        "monitor_errors": 0,
        "changes": [],
    }
    for rule in rules:
        summary["rules_checked"] += 1
        if get_pricing_control(rule.business).emergency_stop_enabled:
            summary["autopilot_blocked"] += 1
            create_pricing_alert(
                business=rule.business,
                rule=rule,
                alert_type=KaspiPricingAlert.Types.EMERGENCY_STOP,
                severity=KaspiPricingAlert.Severities.WARNING,
                title="Ценовой агент остановлен",
                message="Плановый цикл пропустил товар, потому что включен emergency stop.",
            )
            continue
        collected = collect_kaspi_competitor_offers(rule)
        summary["offers_collected"] += collected["offers_created"]
        if collected["error"]:
            summary["monitor_errors"] += 1
            create_pricing_alert(
                business=rule.business,
                rule=rule,
                alert_type=KaspiPricingAlert.Types.MONITOR_FAILED,
                severity=KaspiPricingAlert.Severities.WARNING,
                title="Не удалось собрать цены конкурентов",
                message=collected["error"],
            )
        recommendation = create_kaspi_recommendation(rule)
        summary["recommendations_created"] += 1
        if recommendation.status == KaspiPricingRecommendation.Statuses.BLOCKED:
            summary["blocked"] += 1
        if apply_autopilot and rule.mode == KaspiPricingRule.Modes.AUTOPILOT and not rule.autopilot_confirmed_at:
            summary["autopilot_blocked"] += 1
            continue
        if apply_autopilot and rule.mode == KaspiPricingRule.Modes.AUTOPILOT and recommendation.status == KaspiPricingRecommendation.Statuses.PROPOSED:
            change = apply_kaspi_recommendation(recommendation, user=user)
            summary["changes"].append({"rule_id": rule.id, "recommendation_id": recommendation.id, "change_id": change.id, "status": change.status})
            if change.status in {KaspiPriceChangeLog.Statuses.SIMULATED, KaspiPriceChangeLog.Statuses.QUEUED, KaspiPriceChangeLog.Statuses.APPLIED}:
                summary["autopilot_applied"] += 1
            else:
                summary["autopilot_blocked"] += 1
    return summary


def collect_kaspi_competitor_offers(rule, provider_key=None):
    provider = get_competitor_price_provider(provider_key=provider_key)
    try:
        offers = provider.fetch_offers(rule)
    except Exception as exc:
        rule.last_error = str(exc)
        rule.save(update_fields=["last_error", "updated_at"])
        return {"ok": False, "provider": provider.key, "offers_created": 0, "error": str(exc)}

    created = 0
    for offer in offers:
        KaspiCompetitorOffer.objects.create(
            business=rule.business,
            rule=rule,
            competitor_name=offer.competitor_name,
            competitor_merchant_id=offer.competitor_merchant_id,
            price=offer.price,
            position=offer.position,
            available=offer.available,
            payload_json=offer.payload or {},
        )
        created += 1
    rule.last_checked_at = timezone.now()
    rule.last_error = ""
    rule.save(update_fields=["last_checked_at", "last_error", "updated_at"])
    return {"ok": True, "provider": provider.key, "offers_created": created, "error": ""}


def sync_pricing_catalog_from_events(business, sources=None):
    events = BusinessEvent.objects.filter(business=business, event_type__in=PRICING_CATALOG_EVENT_TYPES).order_by("occurred_at", "id")
    if sources:
        events = events.filter(source__in=sources)

    summary = {"events_scanned": 0, "items_created": 0, "items_updated": 0, "items_skipped": 0}
    for event in events:
        summary["events_scanned"] += 1
        normalized = _catalog_item_from_event(event)
        if not normalized:
            summary["items_skipped"] += 1
            continue

        existing = PricingCatalogItem.objects.filter(business=business, source=normalized["source"], sku=normalized["sku"]).first()
        name = normalized["name"]
        if existing and (not name or name == normalized["sku"]):
            name = existing.name
        current_price = normalized["current_price"] if normalized["current_price"] is not None else (existing.current_price if existing else None)
        stock_quantity = normalized["stock_quantity"] if normalized["stock_quantity"] is not None else (existing.stock_quantity if existing else None)
        item, created = PricingCatalogItem.objects.update_or_create(
            business=business,
            source=normalized["source"],
            sku=normalized["sku"],
            defaults={
                "external_id": normalized["external_id"],
                "name": name,
                "current_price": current_price,
                "stock_quantity": stock_quantity,
                "payload_json": normalized["payload_json"],
                "last_seen_at": event.occurred_at,
            },
        )
        summary["items_created" if created else "items_updated"] += 1
    return summary


def create_pricing_rule_from_catalog_item(item, min_price, current_price=None, step_amount=Decimal("1"), mode=KaspiPricingRule.Modes.APPROVAL, max_changes_per_day=3, user=None):
    price = _decimal_or_none(current_price)
    if price is None:
        price = item.current_price or Decimal("0")
    rule, created = KaspiPricingRule.objects.update_or_create(
        business=item.business,
        product_sku=item.sku,
        defaults={
            "product_name": item.name,
            "kaspi_product_id": item.external_id if item.source == "kaspi" else "",
            "current_price": price,
            "min_price": min_price,
            "step_amount": step_amount or Decimal("1"),
            "mode": mode if mode != KaspiPricingRule.Modes.AUTOPILOT else KaspiPricingRule.Modes.APPROVAL,
            "status": KaspiPricingRule.Statuses.ACTIVE,
            "max_changes_per_day": max_changes_per_day or 3,
            "config_json": {"catalog_item_id": item.id, "catalog_source": item.source, **(item.payload_json or {})},
            "created_by": user,
        },
    )
    return rule, created


def _blocked_change(rule, recommendation, user, reason):
    change = KaspiPriceChangeLog.objects.create(
        business=rule.business,
        rule=rule,
        recommendation=recommendation,
        old_price=rule.current_price,
        new_price=recommendation.target_price,
        status=KaspiPriceChangeLog.Statuses.BLOCKED,
        mode=rule.mode,
        error=reason,
        created_by=user,
    )
    create_pricing_alert(
        business=rule.business,
        rule=rule,
        change_log=change,
        alert_type=KaspiPricingAlert.Types.CHANGE_BLOCKED,
        severity=KaspiPricingAlert.Severities.WARNING,
        title="Изменение цены заблокировано",
        message=reason,
    )
    return change


def get_pricing_control(business):
    control, _ = KaspiPricingControl.objects.get_or_create(business=business)
    return control


def set_pricing_emergency_stop(business, enabled, reason="", user=None):
    control = get_pricing_control(business)
    now = timezone.now()
    control.emergency_stop_enabled = enabled
    if enabled:
        control.emergency_stop_reason = reason
        control.stopped_at = now
        control.stopped_by = user
        control.resumed_at = None
        control.resumed_by = None
        title = "Ценовой агент остановлен"
        message = reason or "Emergency stop включен вручную."
        severity = KaspiPricingAlert.Severities.CRITICAL
    else:
        control.resumed_at = now
        control.resumed_by = user
        control.emergency_stop_reason = ""
        title = "Ценовой агент снова активен"
        message = "Emergency stop выключен."
        severity = KaspiPricingAlert.Severities.INFO
    control.save()
    create_pricing_alert(
        business=business,
        alert_type=KaspiPricingAlert.Types.EMERGENCY_STOP,
        severity=severity,
        title=title,
        message=message,
    )
    return control


def create_pricing_alert(business, alert_type, title, message="", severity=KaspiPricingAlert.Severities.WARNING, rule=None, change_log=None, payload=None):
    alert = KaspiPricingAlert.objects.create(
        business=business,
        rule=rule,
        change_log=change_log,
        alert_type=alert_type,
        severity=severity,
        title=title,
        message=message,
        payload_json=payload or {},
    )
    if severity in {KaspiPricingAlert.Severities.WARNING, KaspiPricingAlert.Severities.CRITICAL}:
        Notification.objects.create(
            business=business,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.AI_ALERTS,
            priority=Notification.Priorities.URGENT if severity == KaspiPricingAlert.Severities.CRITICAL else Notification.Priorities.HIGH,
            text=f"{title}: {message}" if message else title,
            send_at=timezone.now(),
            status=Notification.Statuses.PENDING,
            action_url="/dashboard/pricing",
            action_label="Открыть цены",
        )
    return alert


def _changes_today(rule):
    start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return rule.price_change_logs.filter(created_at__gte=start, status__in=[KaspiPriceChangeLog.Statuses.SIMULATED, KaspiPriceChangeLog.Statuses.QUEUED, KaspiPriceChangeLog.Statuses.APPLIED]).count()


def _decimal_or_none(value):
    if value in (None, ""):
        return None
    return Decimal(str(value))


def _catalog_item_from_event(event):
    payload = event.payload_json or {}
    sku = _first_value(payload, ["sku", "offer_id", "supplierArticle", "article", "code", "barcode", "product_id", "nm_id"])
    if not sku:
        return None
    source = payload.get("source") or event.source or "unknown"
    return {
        "source": str(source),
        "external_id": str(payload.get("product_id") or payload.get("stock_id") or payload.get("assortment_id") or event.external_id or ""),
        "sku": str(sku),
        "name": str(_first_value(payload, ["name", "product_name", "title"]) or sku),
        "current_price": _first_decimal(payload, ["current_price", "price", "price_from", "amount"]),
        "stock_quantity": _first_decimal(payload, ["stock_quantity", "quantity", "available", "total_stock"]),
        "payload_json": {
            "event_id": event.id,
            "event_type": event.event_type,
            "source": event.source,
            "payload": payload,
        },
    }


def _first_value(payload, keys):
    for key in keys:
        value = payload.get(key)
        if value not in (None, ""):
            return value
    return ""


def _first_decimal(payload, keys):
    for key in keys:
        value = payload.get(key)
        if value not in (None, ""):
            try:
                return Decimal(str(value))
            except Exception:
                continue
    return None
