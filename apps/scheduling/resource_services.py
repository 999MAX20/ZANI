"""Atomic resource setup, independent of CRM account invitation and billing."""
from datetime import time

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.businesses.models import Business
from apps.scheduling.models import Resource, WorkingHours


def validate_week(days):
    if len(days) != 7 or {day["weekday"] for day in days} != set(range(7)):
        raise ValidationError({"weekly_schedule": "Provide each weekday exactly once."})
    for day in days:
        if day["start_time"] >= day["end_time"]:
            raise ValidationError({"weekly_schedule": "Start time must precede end time."})
    return days


def validate_staff_account(*, business, resource_type, linked_user, exclude_id=None):
    if linked_user is not None and resource_type == Resource.ResourceTypes.STAFF:
        duplicate = Resource.objects.filter(business=business, resource_type=resource_type, linked_user=linked_user).exclude(pk=exclude_id)
        if duplicate.exists():
            raise ValidationError({"linked_user": "This account already has a specialist in this business. Use the existing specialist."})


@transaction.atomic
def create_resource(*, weekly_schedule=None, **attributes):
    business = attributes["business"]
    Business.objects.select_for_update().get(pk=business.pk)
    validate_staff_account(business=business, resource_type=attributes.get("resource_type", Resource.ResourceTypes.STAFF), linked_user=attributes.get("linked_user"))
    if weekly_schedule is not None:
        validate_week(weekly_schedule)
    resource = Resource.objects.create(**attributes)
    if weekly_schedule is None and resource.resource_type == Resource.ResourceTypes.STAFF:
        business_week = {row.weekday: row for row in WorkingHours.objects.filter(business=business, resource=None)}
        weekly_schedule = []
        for weekday in range(7):
            row = business_week.get(weekday)
            weekly_schedule.append({
                "weekday": weekday,
                "start_time": row.start_time if row else time(9),
                "end_time": row.end_time if row else time(18),
                "is_day_off": row.is_day_off if row else True,
            })
    if weekly_schedule is not None:
        WorkingHours.objects.bulk_create([
            WorkingHours(business=business, resource=resource, **day) for day in weekly_schedule
        ])
    return resource
