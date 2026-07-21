from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError


def parse_bounded_date_range(params, *, default_days=90, max_days=None):
    max_days = max_days or settings.REPORT_MAX_RANGE_DAYS
    raw_start = params.get("start", "") or ""
    raw_end = params.get("end", "") or ""
    start_date = parse_date(raw_start) if raw_start else None
    end_date = parse_date(raw_end) if raw_end else None
    errors = {}
    if raw_start and start_date is None:
        errors["start"] = "Use YYYY-MM-DD."
    if raw_end and end_date is None:
        errors["end"] = "Use YYYY-MM-DD."
    if errors:
        raise ValidationError(errors)

    if end_date is None:
        end_date = timezone.localdate()
    if start_date is None:
        start_date = end_date - timedelta(days=default_days - 1)
    if start_date > end_date:
        raise ValidationError({"date_range": "Start date must not be after end date."})
    days = (end_date - start_date).days + 1
    if days > max_days:
        raise ValidationError({"date_range": f"Date range cannot exceed {max_days} days."})
    return start_date, end_date
