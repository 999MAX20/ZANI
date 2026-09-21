from django.db import transaction
from django.db.models import Q

from apps.bots.models import BotConversation
from apps.businesses.access import Actions, Resources, assert_can
from apps.clients.models import Client
from apps.conversations.models import Conversation
from apps.core.archive import archive_instance
from apps.core.domain_errors import InvalidTransition
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


def client_has_unfinished_work(client):
    """Check business state, including hidden children, without exposing their data."""
    related = {"business_id": client.business_id, "client_id": client.pk, "is_archived": False}
    queries = (
        Lead.objects.filter(**related).exclude(status__in=(Lead.Statuses.CLOSED, Lead.Statuses.LOST)),
        Deal.objects.filter(**related).exclude(status__in=(Deal.Statuses.WON, Deal.Statuses.LOST)),
        Appointment.objects.filter(**related).exclude(status__in=(
            Appointment.Statuses.COMPLETED, Appointment.Statuses.CANCELLED, Appointment.Statuses.NO_SHOW,
        )),
        Conversation.objects.filter(**related, status=Conversation.Statuses.OPEN),
    )
    if any(query.exists() for query in queries):
        return True

    inbox_client = (
        Q(client_id=client.pk)
        | Q(lead__client_id=client.pk, lead__business_id=client.business_id)
        | Q(deal__client_id=client.pk, deal__business_id=client.business_id)
    )
    inbox = BotConversation.objects.filter(business_id=client.business_id).filter(inbox_client)
    if inbox.filter(is_archived=False).exclude(status=BotConversation.Statuses.ARCHIVED).filter(
        Q(status=BotConversation.Statuses.OPEN) | Q(handoff_required=True)
    ).exists():
        return True

    task_client = (
        Q(client_id=client.pk)
        | Q(lead__client_id=client.pk, lead__business_id=client.business_id)
        | Q(deal__client_id=client.pk, deal__business_id=client.business_id)
        | Q(appointment__client_id=client.pk, appointment__business_id=client.business_id)
        | Q(conversation_id__in=inbox.values("pk"))
    )
    return Task.objects.filter(business_id=client.business_id, is_archived=False).filter(task_client).exclude(
        status__in=(Task.Statuses.DONE, Task.Statuses.CANCELLED),
    ).exists()


@transaction.atomic
def archive_client(*, request, client, reason=""):
    client = Client.objects.select_for_update().get(pk=client.pk, business_id=client.business_id)
    assert_can(request.user, client.business, Resources.CLIENTS, Actions.DELETE, obj=client)
    if client.is_archived:
        return client
    if client_has_unfinished_work(client):
        raise InvalidTransition("Resolve the client's unfinished work before archiving.")
    return archive_instance(request, client, reason=reason)
