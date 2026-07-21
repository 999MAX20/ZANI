from apps.activities.taxonomy import ActivityEvents
from apps.bots.inbox_service import record_inbox_crm_activity
from apps.tasks.models import Task


def create_task_from_conversation(
    *,
    conversation,
    actor,
    title: str = "",
    description: str = "",
    priority: str = Task.Priorities.NORMAL,
    due_at=None,
) -> Task:
    task_title = title or f"Follow up: {conversation.client or conversation.external_user_id or conversation.id}"
    task = Task.objects.create(
        business=conversation.business,
        title=task_title,
        description=description or "",
        client=conversation.client,
        lead=conversation.lead,
        deal=conversation.deal,
        conversation=conversation,
        assignee=actor,
        created_by=actor,
        priority=priority or Task.Priorities.NORMAL,
        due_at=due_at,
    )
    record_inbox_crm_activity(
        conversation,
        entity=task,
        event_type=ActivityEvents.TASK_CREATED,
        actor=actor,
        text="Task created from inbox conversation.",
        metadata={
            "task_id": task.id,
            "client_id": task.client_id,
            "lead_id": task.lead_id,
            "deal_id": task.deal_id,
        },
    )
    return task
