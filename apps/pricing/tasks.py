from celery import shared_task
from django.conf import settings

from apps.pricing.services import run_kaspi_pricing_cycle


@shared_task(bind=True, name="pricing.run_kaspi_pricing_cycle", queue="integrations")
def run_kaspi_pricing_cycle_task(self, business_id=None, apply_autopilot=None):
    if not settings.KASPI_REPRICING_ENABLED:
        return {
            "skipped": True,
            "reason": "KASPI_REPRICING_ENABLED=False",
            "rules_checked": 0,
            "recommendations_created": 0,
        }

    should_apply_autopilot = settings.KASPI_REPRICING_APPLY_AUTOPILOT if apply_autopilot is None else bool(apply_autopilot)
    summary = run_kaspi_pricing_cycle(business_id=business_id, apply_autopilot=should_apply_autopilot)
    return {"skipped": False, "apply_autopilot": should_apply_autopilot, **summary}
