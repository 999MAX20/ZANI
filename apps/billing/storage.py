from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows, check_entitlement
from apps.core.models import FileAttachment


DEFAULT_STORAGE_LIMITS_MB = {
    "start": 100,
    "growth": 2048,
    "platform": 10240,
}


def get_storage_limit_mb(business):
    return check_entitlement(business, EntitlementMetrics.STORAGE_MB, requested=0).limit


def get_storage_usage_bytes(business):
    return (
        FileAttachment.objects.filter(business=business)
        .aggregate(total=Sum("size"))
        .get("total")
        or 0
    )


def storage_usage_summary(business):
    used_bytes = get_storage_usage_bytes(business)
    limit_mb = get_storage_limit_mb(business)
    limit_bytes = limit_mb * 1024 * 1024 if limit_mb is not None else None
    used_mb = round(used_bytes / 1024 / 1024, 2)

    return {
        "metric": "storage_mb",
        "value": used_mb,
        "value_bytes": used_bytes,
        "limit": limit_mb,
        "limit_bytes": limit_bytes,
        "is_limited": limit_mb is not None,
        "is_over_limit": bool(limit_bytes is not None and used_bytes >= limit_bytes),
    }


def assert_storage_quota_allows(business, additional_bytes):
    try:
        assert_entitlement_allows(business, EntitlementMetrics.STORAGE_MB, requested=int(additional_bytes or 0) / 1024 / 1024)
    except ValidationError:
        limit_mb = get_storage_limit_mb(business)
        used_bytes = get_storage_usage_bytes(business)
        raise ValidationError(
            {
                "file": (
                    "Storage limit exceeded. "
                    f"Used {round(used_bytes / 1024 / 1024, 2)} MB of {limit_mb} MB."
                )
            }
        )
