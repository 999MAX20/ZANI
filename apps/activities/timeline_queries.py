"""Read-only activity filters. Input querysets must already be access-scoped."""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Exists, F, OuterRef, Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination

from apps.businesses.access import Actions, Resources, assert_can
from apps.businesses.capabilities import assert_resource_enabled
from apps.businesses.models import BusinessMember
from apps.core.permissions import accessible_businesses


class ActivityPagination(PageNumberPagination):
    page_size = 50  # Preserve existing callers' default.
    page_size_query_param = "page_size"
    max_page_size = 100


MAX_ID = 2**63 - 1


class TimelineQuery(serializers.Serializer):
    business = serializers.IntegerField(min_value=1, max_value=MAX_ID, required=False)
    client = serializers.IntegerField(min_value=1, max_value=MAX_ID, required=False)
    entity_type = serializers.CharField(max_length=96, required=False)
    entity_id = serializers.CharField(max_length=64, required=False)
    category = serializers.ChoiceField(choices=("crm", "message", "appointment", "task", "automation", "system"), required=False)
    event_type = serializers.CharField(max_length=96, required=False)
    q = serializers.CharField(max_length=160, required=False)
    actor = serializers.CharField(max_length=20, required=False)
    selected_actor = serializers.IntegerField(min_value=1, max_value=MAX_ID, required=False)
    date_from = serializers.CharField(max_length=40, required=False)
    date_to = serializers.CharField(max_length=40, required=False)

    def validate_actor(self, value):
        if value != "none" and (not value.isdecimal() or not 1 <= int(value) <= MAX_ID):
            raise serializers.ValidationError("Invalid actor filter.")
        return value


def read_timeline_query(request):
    params = request.query_params.copy()
    for canonical, alias in (("client", "client_id"), ("date_from", "created_after"), ("date_to", "created_before")):
        if not params.get(canonical) and params.get(alias):
            params[canonical] = params[alias]
    params = {key: value for key, value in params.items() if value != ""}
    serializer = TimelineQuery(data=params)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    business = None
    if values.get("business"):
        business = accessible_businesses(request.user).filter(pk=values["business"]).first()
        if business is None:
            raise NotFound()
        assert_can(request.user, business, Resources.ANALYTICS, Actions.VIEW)
        assert_resource_enabled(business, Resources.ANALYTICS)
    return values, business


def date_boundary(value, *, end, business):
    try:
        tz = ZoneInfo(business.timezone) if business else timezone.get_current_timezone()
    except ZoneInfoNotFoundError:
        tz = timezone.get_current_timezone()
    try:
        day = parse_date(value) if len(value) == 10 else None
        if day:
            return datetime.combine(day + timedelta(days=1 if end else 0), time.min, tzinfo=tz), end
        stamp = parse_datetime(value)
        if stamp:
            return timezone.make_aware(stamp, tz) if timezone.is_naive(stamp) else stamp, False
    except (ValueError, OverflowError):
        pass
    raise serializers.ValidationError({"date_to" if end else "date_from": "Invalid date."})


def filter_timeline(queryset, values, business):
    for field in ("business", "client", "entity_type", "entity_id", "category", "event_type"):
        if values.get(field):
            queryset = queryset.filter(**{field: values[field]})
    actor = values.get("actor")
    if actor:
        queryset = queryset.filter(actor__isnull=True) if actor == "none" else queryset.filter(actor_id=int(actor))
    boundaries = []
    for field, end in (("date_from", False), ("date_to", True)):
        if values.get(field):
            stamp, exclusive = date_boundary(values[field], end=end, business=business)
            boundaries.append(stamp)
            lookup = "lt" if exclusive else "lte" if end else "gte"
            queryset = queryset.filter(**{f"created_at__{lookup}": stamp})
    if len(boundaries) == 2 and (boundaries[0] > boundaries[1] or exclusive and boundaries[0] == boundaries[1]):
        raise serializers.ValidationError({"date_to": "Invalid date range."})
    if values.get("q"):
        query = values["q"]
        queryset = queryset.filter(Q(text__icontains=query) | Q(event_type__icontains=query) | Q(client__business_id=F("business_id"), client__full_name__icontains=query))
    members = BusinessMember.objects.filter(business_id=OuterRef("business_id"), user_id=OuterRef("actor_id"))
    return queryset.annotate(actor_is_member=Exists(members)).order_by("-created_at", "-pk")


def timeline_actor_rows(queryset, query=""):
    queryset = queryset.filter(Q(actor_is_member=True) | Q(actor_id=F("business__owner_id"))).exclude(actor_id=None)
    if query:
        queryset = queryset.filter(Q(actor__full_name__icontains=query) | Q(actor__first_name__icontains=query) | Q(actor__last_name__icontains=query))
    return queryset.order_by("actor__full_name", "actor_id").values("actor_id", "actor__full_name", "actor__first_name", "actor__last_name").distinct()


def actor_choice(row):
    if not row:
        return None
    return {"id": row["actor_id"], "name": row["actor__full_name"] or " ".join(filter(None, (row["actor__first_name"], row["actor__last_name"]))).strip()}
