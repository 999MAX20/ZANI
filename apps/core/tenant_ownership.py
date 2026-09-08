from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import ValidationError


IMMUTABLE_TENANT_OWNERSHIP_MESSAGE = "The owning business cannot be changed."


def _resolve_lookup(value, lookup_parts):
    for part in lookup_parts:
        if value is None:
            return None
        try:
            value = getattr(value, part)
        except (AttributeError, ObjectDoesNotExist):
            return None
    return value


def _business_identity(business):
    if business is None:
        return None
    return getattr(business, "pk", business)


def assert_tenant_ownership_unchanged(serializer, *, business_lookup: str) -> None:
    """Reject generic API updates that move an object between businesses."""
    if serializer.instance is None:
        return

    lookup_parts = business_lookup.split("__")
    ownership_field = lookup_parts[0]
    if ownership_field not in serializer.validated_data:
        return

    current_business = _resolve_lookup(serializer.instance, lookup_parts)
    proposed_owner = serializer.validated_data[ownership_field]
    proposed_business = _resolve_lookup(proposed_owner, lookup_parts[1:])
    if _business_identity(current_business) == _business_identity(proposed_business):
        return

    raise ValidationError({ownership_field: IMMUTABLE_TENANT_OWNERSHIP_MESSAGE})
