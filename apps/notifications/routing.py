from django.utils import timezone

from apps.businesses.models import BusinessMember
from apps.notifications.models import Notification, NotificationPreference


SALES_WORK_ROLES = {
    BusinessMember.Roles.ADMIN,
    BusinessMember.Roles.MANAGER,
    BusinessMember.Roles.OPERATOR,
    BusinessMember.Roles.SUPPORT,
    BusinessMember.Roles.STAFF,
}

MANAGER_ROLES = {
    BusinessMember.Roles.ADMIN,
    BusinessMember.Roles.MANAGER,
    BusinessMember.Roles.OPERATOR,
}

TECHNICAL_ROLES = {
    BusinessMember.Roles.ADMIN,
    BusinessMember.Roles.MANAGER,
}


def create_role_notification(
    *,
    business,
    text,
    category=Notification.Categories.SALES,
    priority=Notification.Priorities.NORMAL,
    action_url="",
    action_label="Открыть",
    client=None,
    appointment=None,
    preferred_user=None,
    roles=None,
    exclude_owner=True,
    fallback_to_owner=True,
):
    recipients = resolve_notification_recipients(
        business=business,
        preferred_user=preferred_user,
        roles=roles or SALES_WORK_ROLES,
        exclude_owner=exclude_owner,
        fallback_to_owner=fallback_to_owner,
    )
    recipients = filter_notification_recipients(
        business=business,
        users=recipients,
        category=category,
        priority=priority,
    )
    notifications = [
        Notification(
            business=business,
            recipient=user,
            client=client,
            appointment=appointment,
            channel=Notification.Channels.SYSTEM,
            category=category,
            priority=priority,
            text=text,
            send_at=timezone.now(),
            status=Notification.Statuses.PENDING,
            action_url=action_url,
            action_label=action_label,
        )
        for user in recipients
    ]
    return Notification.objects.bulk_create(notifications)


def filter_notification_recipients(*, business, users, category, priority):
    if priority in {Notification.Priorities.HIGH, Notification.Priorities.URGENT}:
        return users
    if not users:
        return []
    disabled_user_ids = set(
        NotificationPreference.objects.filter(
            business=business,
            user__in=users,
            category=category,
            in_app_enabled=False,
        ).values_list("user_id", flat=True)
    )
    return [user for user in users if user.id not in disabled_user_ids]


def resolve_notification_recipients(*, business, preferred_user=None, roles=None, exclude_owner=True, fallback_to_owner=True):
    roles = roles or SALES_WORK_ROLES
    if preferred_user is not None:
        membership = (
            BusinessMember.objects.select_related("user")
            .filter(business=business, user=preferred_user, is_active=True, role__in=roles)
            .first()
        )
        if membership and not (exclude_owner and membership.user_id == business.owner_id):
            return [membership.user]

    memberships = BusinessMember.objects.select_related("user").filter(business=business, is_active=True, role__in=roles)
    if exclude_owner:
        memberships = memberships.exclude(user_id=business.owner_id)
    users = [membership.user for membership in memberships.order_by("role", "id")]
    if users:
        return users
    if fallback_to_owner and business.owner_id:
        return [business.owner]
    return []
