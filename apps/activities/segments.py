from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.activities.models import Segment, SegmentFilter, TaggedObject
from apps.clients.models import Client


def _value_list(value_json):
    value = value_json.get("value")
    if value is None:
        value = value_json.get("values", [])
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return [str(value).strip()] if value not in (None, "") else []


def _scalar(value_json):
    values = _value_list(value_json)
    return values[0] if values else ""


def apply_segment_filter(queryset: QuerySet[Client], segment_filter: SegmentFilter) -> QuerySet[Client]:
    field = segment_filter.field
    operator = segment_filter.operator
    value = _scalar(segment_filter.value_json)
    values = _value_list(segment_filter.value_json)

    if field == SegmentFilter.Fields.TAG:
        tag_ids = []
        tag_names = []
        for item in values:
            if item.isdigit():
                tag_ids.append(int(item))
            else:
                tag_names.append(item)
        tagged_ids = TaggedObject.objects.filter(
            business=segment_filter.business,
            entity_type="client",
        )
        if tag_ids:
            tagged_ids = tagged_ids.filter(tag_id__in=tag_ids)
        elif tag_names:
            tagged_ids = tagged_ids.filter(tag__name__in=tag_names)
        else:
            return queryset.none() if operator != SegmentFilter.Operators.IS_EMPTY else queryset
        client_ids = tagged_ids.values_list("entity_id", flat=True)
        return queryset.filter(id__in=client_ids)

    if operator == SegmentFilter.Operators.IS_EMPTY:
        return queryset.filter(Q(**{field: ""}) | Q(**{f"{field}__isnull": True}))
    if operator == SegmentFilter.Operators.NOT_EMPTY:
        return queryset.exclude(Q(**{field: ""}) | Q(**{f"{field}__isnull": True}))
    if operator == SegmentFilter.Operators.CONTAINS:
        return queryset.filter(**{f"{field}__icontains": value})
    if operator == SegmentFilter.Operators.IN:
        return queryset.filter(**{f"{field}__in": values})
    if operator == SegmentFilter.Operators.GTE:
        return queryset.filter(**{f"{field}__gte": value})
    if operator == SegmentFilter.Operators.LTE:
        return queryset.filter(**{f"{field}__lte": value})
    return queryset.filter(**{field: value})


def evaluate_segment_queryset(segment: Segment) -> QuerySet[Client]:
    if segment.entity_type != Segment.EntityTypes.CLIENT:
        return Client.objects.none()
    queryset = Client.objects.filter(business=segment.business, is_archived=False)
    for segment_filter in segment.filters.all().order_by("sort_order", "id"):
        queryset = apply_segment_filter(queryset, segment_filter)
    return queryset.distinct()


def refresh_segment_count(segment: Segment) -> int:
    count = evaluate_segment_queryset(segment).count()
    segment.cached_count = count
    segment.last_evaluated_at = timezone.now()
    segment.save(update_fields=["cached_count", "last_evaluated_at", "updated_at"])
    return count
