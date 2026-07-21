from django.utils import timezone

from apps.notifications.models import Notification


def create_assignment_notifications(*, business, previous_user, new_user, text, action_url, include_new=True):
    recipients = []
    if include_new and new_user is not None:
        recipients.append((new_user, text))
    if previous_user is not None and previous_user != new_user:
        recipients.append((previous_user, f"Work item reassigned: {text}"))
    return Notification.objects.bulk_create(
        [
            Notification(
                business=business,
                recipient=recipient,
                channel=Notification.Channels.SYSTEM,
                category=Notification.Categories.TASKS,
                priority=Notification.Priorities.NORMAL,
                text=message,
                send_at=timezone.now(),
                action_url=action_url,
                action_label="Open",
            )
            for recipient, message in recipients
        ]
    )
