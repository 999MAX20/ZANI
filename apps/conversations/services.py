from apps.tasks.models import Task
from apps.tasks.services import create_automation_task


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
    return create_automation_task(
        business=conversation.business,
        title=task_title,
        description=description or "",
        entity=conversation,
        actor=actor,
        assignee=actor,
        priority=priority or Task.Priorities.NORMAL,
        due_at=due_at,
        source="inbox",
        source_payload={
            "trigger_type": "conversation_create_task",
            "conversation_id": conversation.id,
        },
        activity_text="Task created from inbox conversation.",
        notification_text=f"New inbox task: {task_title}",
    )
