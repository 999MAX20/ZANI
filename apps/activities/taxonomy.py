from dataclasses import dataclass

from apps.activities.models import ActivityEvent


class ActivityEvents:
    CLIENT_CREATED = "client_created"
    CLIENT_UPDATED = "client_updated"
    CLIENT_MERGED = "client_merged"
    CLIENT_ARCHIVED = "client_archived"
    CLIENT_RESTORED = "client_restored"

    FORM_SUBMITTED = "form_submitted"
    LEAD_CREATED = "lead_created"
    LEAD_ASSIGNED = "lead_assigned"
    LEAD_STATUS_CHANGED = "lead_status_changed"
    LEAD_TAKEN_IN_WORK = "lead_taken_in_work"
    LEAD_CONTACTED = "lead_contacted"
    LEAD_CLOSED = "lead_closed"
    LEAD_LOST = "lead_lost"
    LEAD_REOPENED = "lead_reopened"
    LEAD_NOTE_ADDED = "lead_note_added"
    LEAD_CONVERTED_TO_CLIENT = "lead_converted_to_client"

    DEAL_CREATED = "deal_created"
    DEAL_CREATED_FROM_LEAD = "deal_created_from_lead"
    DEAL_STAGE_CHANGED = "deal_stage_changed"
    DEAL_VALUE_CHANGED = "deal_value_changed"
    DEAL_WON = "deal_won"
    DEAL_LOST = "deal_lost"
    DEAL_REOPENED = "deal_reopened"

    APPOINTMENT_CREATED = "appointment_created"
    APPOINTMENT_CONFIRMED = "appointment_confirmed"
    APPOINTMENT_CANCELLED = "appointment_cancelled"
    APPOINTMENT_COMPLETED = "appointment_completed"
    APPOINTMENT_NO_SHOW = "appointment_no_show"
    APPOINTMENT_RESCHEDULED = "appointment_rescheduled"

    TASK_CREATED = "task_created"
    TASK_UPDATED = "task_updated"
    TASK_STARTED = "task_started"
    TASK_COMPLETED = "task_completed"
    TASK_CANCELLED = "task_cancelled"
    TASK_REOPENED = "task_reopened"
    TASK_SNOOZED = "task_snoozed"
    TASK_ASSIGNED = "task_assigned"
    TASK_ASSIGNED_TO_ME = "task_assigned_to_me"
    TASK_DUE_TODAY = "task_due_today"
    TASK_DUE_TOMORROW = "task_due_tomorrow"
    TASK_WATCHER_ADDED = "task_watcher_added"
    TASK_COMMENT_ADDED = "task_comment_added"
    TASK_COMMENT_DELETED = "task_comment_deleted"

    MESSAGE_RECEIVED = "message_received"
    MESSAGE_SENT = "message_sent"
    MESSAGE_RETRIED = "message_retried"
    CONVERSATION_QUALIFICATION_PREVIEWED = "conversation_qualification_previewed"
    CONVERSATION_CLIENT_LINKED = "conversation_client_linked"
    CONVERSATION_LEAD_LINKED = "conversation_lead_linked"
    CONVERSATION_DEAL_LINKED = "conversation_deal_linked"
    NOTE_CREATED = "note_created"
    AUTOMATION_RUN = "automation_run"
    INTEGRATION_EVENT = "integration_event"
    DELIVERY_FAILED = "delivery_failed"


EVENT_ALIASES = {
    "client.archived": ActivityEvents.CLIENT_ARCHIVED,
    "client.restored": ActivityEvents.CLIENT_RESTORED,
    "deal_marked_won": ActivityEvents.DEAL_WON,
    "deal_marked_lost": ActivityEvents.DEAL_LOST,
    "lead_marked_lost": ActivityEvents.LEAD_LOST,
}


EVENT_LABELS = {
    ActivityEvents.CLIENT_CREATED: "Создан клиент",
    ActivityEvents.CLIENT_UPDATED: "Обновлён клиент",
    ActivityEvents.CLIENT_MERGED: "Клиенты объединены",
    ActivityEvents.CLIENT_ARCHIVED: "Клиент архивирован",
    ActivityEvents.CLIENT_RESTORED: "Клиент восстановлен",
    ActivityEvents.FORM_SUBMITTED: "Отправлена форма",
    ActivityEvents.LEAD_CREATED: "Создана заявка",
    ActivityEvents.LEAD_ASSIGNED: "Назначен ответственный по заявке",
    ActivityEvents.LEAD_STATUS_CHANGED: "Изменён статус заявки",
    ActivityEvents.LEAD_TAKEN_IN_WORK: "Заявка взята в работу",
    ActivityEvents.LEAD_CONTACTED: "С клиентом по заявке связались",
    ActivityEvents.LEAD_CLOSED: "Заявка закрыта успешно",
    ActivityEvents.LEAD_LOST: "Заявка закрыта как отказ",
    ActivityEvents.LEAD_REOPENED: "Заявка возвращена в работу",
    ActivityEvents.LEAD_NOTE_ADDED: "Добавлена заметка к заявке",
    ActivityEvents.LEAD_CONVERTED_TO_CLIENT: "Заявка конвертирована в клиента",
    ActivityEvents.DEAL_CREATED: "Создана сделка",
    ActivityEvents.DEAL_CREATED_FROM_LEAD: "Сделка создана из заявки",
    ActivityEvents.DEAL_STAGE_CHANGED: "Сделка перешла на другую стадию",
    ActivityEvents.DEAL_VALUE_CHANGED: "Изменена сумма сделки",
    ActivityEvents.DEAL_WON: "Сделка выиграна",
    ActivityEvents.DEAL_LOST: "Сделка проиграна",
    ActivityEvents.DEAL_REOPENED: "Сделка возвращена в работу",
    ActivityEvents.APPOINTMENT_CREATED: "Создана запись",
    ActivityEvents.APPOINTMENT_CONFIRMED: "Запись подтверждена",
    ActivityEvents.APPOINTMENT_CANCELLED: "Запись отменена",
    ActivityEvents.APPOINTMENT_COMPLETED: "Визит завершён",
    ActivityEvents.APPOINTMENT_NO_SHOW: "Клиент не пришёл",
    ActivityEvents.APPOINTMENT_RESCHEDULED: "Запись перенесена",
    ActivityEvents.TASK_CREATED: "Создана задача",
    ActivityEvents.TASK_UPDATED: "Обновлена задача",
    ActivityEvents.TASK_STARTED: "Задача взята в работу",
    ActivityEvents.TASK_COMPLETED: "Задача закрыта",
    ActivityEvents.TASK_CANCELLED: "Задача отменена",
    ActivityEvents.TASK_REOPENED: "Задача переоткрыта",
    ActivityEvents.TASK_SNOOZED: "Задача отложена",
    ActivityEvents.TASK_ASSIGNED: "Задача назначена",
    ActivityEvents.TASK_ASSIGNED_TO_ME: "Задача взята на себя",
    ActivityEvents.TASK_DUE_TODAY: "Задача поставлена на сегодня",
    ActivityEvents.TASK_DUE_TOMORROW: "Задача поставлена на завтра",
    ActivityEvents.TASK_WATCHER_ADDED: "Добавлен наблюдатель к задаче",
    ActivityEvents.TASK_COMMENT_ADDED: "Добавлен комментарий к задаче",
    ActivityEvents.TASK_COMMENT_DELETED: "Удалён комментарий к задаче",
    ActivityEvents.MESSAGE_RECEIVED: "Получено сообщение",
    ActivityEvents.MESSAGE_SENT: "Отправлено сообщение",
    ActivityEvents.MESSAGE_RETRIED: "Message retry requested",
    ActivityEvents.CONVERSATION_QUALIFICATION_PREVIEWED: "Conversation qualification previewed",
    ActivityEvents.CONVERSATION_CLIENT_LINKED: "Conversation linked to client",
    ActivityEvents.CONVERSATION_LEAD_LINKED: "Conversation linked to lead",
    ActivityEvents.CONVERSATION_DEAL_LINKED: "Conversation linked to deal",
    ActivityEvents.NOTE_CREATED: "Добавлена заметка",
    ActivityEvents.AUTOMATION_RUN: "Сработала автоматизация",
    ActivityEvents.INTEGRATION_EVENT: "Integration event",
    ActivityEvents.DELIVERY_FAILED: "Ошибка доставки",
}


@dataclass(frozen=True)
class ActivityEventDefinition:
    event_type: str
    category: str
    domain: str
    label: str
    timeline: bool = True
    audit_required: bool = False
    important: bool = False


def _define(
    event_type: str,
    *,
    category: str,
    domain: str,
    timeline: bool = True,
    audit_required: bool = False,
    important: bool = False,
) -> ActivityEventDefinition:
    return ActivityEventDefinition(
        event_type=event_type,
        category=category,
        domain=domain,
        label=EVENT_LABELS[event_type],
        timeline=timeline,
        audit_required=audit_required,
        important=important,
    )


EVENT_DEFINITIONS = {
    ActivityEvents.CLIENT_CREATED: _define(ActivityEvents.CLIENT_CREATED, category=ActivityEvent.Categories.CRM, domain="clients"),
    ActivityEvents.CLIENT_UPDATED: _define(ActivityEvents.CLIENT_UPDATED, category=ActivityEvent.Categories.CRM, domain="clients"),
    ActivityEvents.CLIENT_MERGED: _define(
        ActivityEvents.CLIENT_MERGED,
        category=ActivityEvent.Categories.CRM,
        domain="clients",
        audit_required=True,
        important=True,
    ),
    ActivityEvents.CLIENT_ARCHIVED: _define(
        ActivityEvents.CLIENT_ARCHIVED,
        category=ActivityEvent.Categories.CRM,
        domain="clients",
        audit_required=True,
        important=True,
    ),
    ActivityEvents.CLIENT_RESTORED: _define(
        ActivityEvents.CLIENT_RESTORED,
        category=ActivityEvent.Categories.CRM,
        domain="clients",
        audit_required=True,
        important=True,
    ),
    ActivityEvents.FORM_SUBMITTED: _define(ActivityEvents.FORM_SUBMITTED, category=ActivityEvent.Categories.CRM, domain="leads"),
    ActivityEvents.LEAD_CREATED: _define(ActivityEvents.LEAD_CREATED, category=ActivityEvent.Categories.CRM, domain="leads"),
    ActivityEvents.LEAD_ASSIGNED: _define(ActivityEvents.LEAD_ASSIGNED, category=ActivityEvent.Categories.CRM, domain="leads"),
    ActivityEvents.LEAD_STATUS_CHANGED: _define(ActivityEvents.LEAD_STATUS_CHANGED, category=ActivityEvent.Categories.CRM, domain="leads"),
    ActivityEvents.LEAD_TAKEN_IN_WORK: _define(ActivityEvents.LEAD_TAKEN_IN_WORK, category=ActivityEvent.Categories.CRM, domain="leads"),
    ActivityEvents.LEAD_CONTACTED: _define(ActivityEvents.LEAD_CONTACTED, category=ActivityEvent.Categories.CRM, domain="leads"),
    ActivityEvents.LEAD_CLOSED: _define(ActivityEvents.LEAD_CLOSED, category=ActivityEvent.Categories.CRM, domain="leads", important=True),
    ActivityEvents.LEAD_LOST: _define(
        ActivityEvents.LEAD_LOST,
        category=ActivityEvent.Categories.CRM,
        domain="leads",
        audit_required=True,
        important=True,
    ),
    ActivityEvents.LEAD_REOPENED: _define(ActivityEvents.LEAD_REOPENED, category=ActivityEvent.Categories.CRM, domain="leads", audit_required=True),
    ActivityEvents.LEAD_NOTE_ADDED: _define(ActivityEvents.LEAD_NOTE_ADDED, category=ActivityEvent.Categories.CRM, domain="leads"),
    ActivityEvents.LEAD_CONVERTED_TO_CLIENT: _define(
        ActivityEvents.LEAD_CONVERTED_TO_CLIENT,
        category=ActivityEvent.Categories.CRM,
        domain="leads",
        important=True,
    ),
    ActivityEvents.DEAL_CREATED: _define(ActivityEvents.DEAL_CREATED, category=ActivityEvent.Categories.CRM, domain="deals"),
    ActivityEvents.DEAL_CREATED_FROM_LEAD: _define(ActivityEvents.DEAL_CREATED_FROM_LEAD, category=ActivityEvent.Categories.CRM, domain="deals"),
    ActivityEvents.DEAL_STAGE_CHANGED: _define(ActivityEvents.DEAL_STAGE_CHANGED, category=ActivityEvent.Categories.CRM, domain="deals"),
    ActivityEvents.DEAL_VALUE_CHANGED: _define(ActivityEvents.DEAL_VALUE_CHANGED, category=ActivityEvent.Categories.CRM, domain="deals", audit_required=True),
    ActivityEvents.DEAL_WON: _define(ActivityEvents.DEAL_WON, category=ActivityEvent.Categories.CRM, domain="deals", audit_required=True, important=True),
    ActivityEvents.DEAL_LOST: _define(ActivityEvents.DEAL_LOST, category=ActivityEvent.Categories.CRM, domain="deals", audit_required=True, important=True),
    ActivityEvents.DEAL_REOPENED: _define(ActivityEvents.DEAL_REOPENED, category=ActivityEvent.Categories.CRM, domain="deals", audit_required=True),
    ActivityEvents.APPOINTMENT_CREATED: _define(ActivityEvents.APPOINTMENT_CREATED, category=ActivityEvent.Categories.APPOINTMENT, domain="appointments"),
    ActivityEvents.APPOINTMENT_CONFIRMED: _define(ActivityEvents.APPOINTMENT_CONFIRMED, category=ActivityEvent.Categories.APPOINTMENT, domain="appointments"),
    ActivityEvents.APPOINTMENT_CANCELLED: _define(
        ActivityEvents.APPOINTMENT_CANCELLED,
        category=ActivityEvent.Categories.APPOINTMENT,
        domain="appointments",
        audit_required=True,
        important=True,
    ),
    ActivityEvents.APPOINTMENT_COMPLETED: _define(
        ActivityEvents.APPOINTMENT_COMPLETED,
        category=ActivityEvent.Categories.APPOINTMENT,
        domain="appointments",
        audit_required=True,
        important=True,
    ),
    ActivityEvents.APPOINTMENT_NO_SHOW: _define(
        ActivityEvents.APPOINTMENT_NO_SHOW,
        category=ActivityEvent.Categories.APPOINTMENT,
        domain="appointments",
        audit_required=True,
        important=True,
    ),
    ActivityEvents.APPOINTMENT_RESCHEDULED: _define(
        ActivityEvents.APPOINTMENT_RESCHEDULED,
        category=ActivityEvent.Categories.APPOINTMENT,
        domain="appointments",
        audit_required=True,
    ),
    ActivityEvents.TASK_CREATED: _define(ActivityEvents.TASK_CREATED, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_UPDATED: _define(ActivityEvents.TASK_UPDATED, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_STARTED: _define(ActivityEvents.TASK_STARTED, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_COMPLETED: _define(ActivityEvents.TASK_COMPLETED, category=ActivityEvent.Categories.TASK, domain="tasks", important=True),
    ActivityEvents.TASK_CANCELLED: _define(
        ActivityEvents.TASK_CANCELLED,
        category=ActivityEvent.Categories.TASK,
        domain="tasks",
        audit_required=True,
        important=True,
    ),
    ActivityEvents.TASK_REOPENED: _define(ActivityEvents.TASK_REOPENED, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_SNOOZED: _define(ActivityEvents.TASK_SNOOZED, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_ASSIGNED: _define(ActivityEvents.TASK_ASSIGNED, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_ASSIGNED_TO_ME: _define(ActivityEvents.TASK_ASSIGNED_TO_ME, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_DUE_TODAY: _define(ActivityEvents.TASK_DUE_TODAY, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_DUE_TOMORROW: _define(ActivityEvents.TASK_DUE_TOMORROW, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_WATCHER_ADDED: _define(ActivityEvents.TASK_WATCHER_ADDED, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_COMMENT_ADDED: _define(ActivityEvents.TASK_COMMENT_ADDED, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.TASK_COMMENT_DELETED: _define(ActivityEvents.TASK_COMMENT_DELETED, category=ActivityEvent.Categories.TASK, domain="tasks"),
    ActivityEvents.MESSAGE_RECEIVED: _define(ActivityEvents.MESSAGE_RECEIVED, category=ActivityEvent.Categories.MESSAGE, domain="conversations"),
    ActivityEvents.MESSAGE_SENT: _define(ActivityEvents.MESSAGE_SENT, category=ActivityEvent.Categories.MESSAGE, domain="conversations"),
    ActivityEvents.MESSAGE_RETRIED: _define(ActivityEvents.MESSAGE_RETRIED, category=ActivityEvent.Categories.MESSAGE, domain="conversations"),
    ActivityEvents.CONVERSATION_QUALIFICATION_PREVIEWED: _define(
        ActivityEvents.CONVERSATION_QUALIFICATION_PREVIEWED,
        category=ActivityEvent.Categories.MESSAGE,
        domain="conversations",
    ),
    ActivityEvents.CONVERSATION_CLIENT_LINKED: _define(
        ActivityEvents.CONVERSATION_CLIENT_LINKED,
        category=ActivityEvent.Categories.MESSAGE,
        domain="conversations",
    ),
    ActivityEvents.CONVERSATION_LEAD_LINKED: _define(
        ActivityEvents.CONVERSATION_LEAD_LINKED,
        category=ActivityEvent.Categories.MESSAGE,
        domain="conversations",
    ),
    ActivityEvents.CONVERSATION_DEAL_LINKED: _define(
        ActivityEvents.CONVERSATION_DEAL_LINKED,
        category=ActivityEvent.Categories.MESSAGE,
        domain="conversations",
    ),
    ActivityEvents.NOTE_CREATED: _define(ActivityEvents.NOTE_CREATED, category=ActivityEvent.Categories.CRM, domain="notes"),
    ActivityEvents.AUTOMATION_RUN: _define(ActivityEvents.AUTOMATION_RUN, category=ActivityEvent.Categories.AUTOMATION, domain="automations"),
    ActivityEvents.INTEGRATION_EVENT: _define(
        ActivityEvents.INTEGRATION_EVENT,
        category=ActivityEvent.Categories.SYSTEM,
        domain="integrations",
    ),
    ActivityEvents.DELIVERY_FAILED: _define(
        ActivityEvents.DELIVERY_FAILED,
        category=ActivityEvent.Categories.SYSTEM,
        domain="notifications",
        important=True,
    ),
}


TIMELINE_EVENT_TYPES = frozenset(
    event_type for event_type, definition in EVENT_DEFINITIONS.items() if definition.timeline
)
AUDIT_REQUIRED_EVENT_TYPES = frozenset(
    event_type for event_type, definition in EVENT_DEFINITIONS.items() if definition.audit_required
)
IMPORTANT_EVENT_TYPES = frozenset(
    event_type for event_type, definition in EVENT_DEFINITIONS.items() if definition.important
)


EVENT_CATEGORIES = {
    ActivityEvents.MESSAGE_RECEIVED: ActivityEvent.Categories.MESSAGE,
    ActivityEvents.MESSAGE_SENT: ActivityEvent.Categories.MESSAGE,
    ActivityEvents.APPOINTMENT_CREATED: ActivityEvent.Categories.APPOINTMENT,
    ActivityEvents.APPOINTMENT_CONFIRMED: ActivityEvent.Categories.APPOINTMENT,
    ActivityEvents.APPOINTMENT_CANCELLED: ActivityEvent.Categories.APPOINTMENT,
    ActivityEvents.APPOINTMENT_COMPLETED: ActivityEvent.Categories.APPOINTMENT,
    ActivityEvents.APPOINTMENT_NO_SHOW: ActivityEvent.Categories.APPOINTMENT,
    ActivityEvents.APPOINTMENT_RESCHEDULED: ActivityEvent.Categories.APPOINTMENT,
    ActivityEvents.TASK_CREATED: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_UPDATED: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_STARTED: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_COMPLETED: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_CANCELLED: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_REOPENED: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_SNOOZED: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_ASSIGNED: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_ASSIGNED_TO_ME: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_DUE_TODAY: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_DUE_TOMORROW: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_WATCHER_ADDED: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_COMMENT_ADDED: ActivityEvent.Categories.TASK,
    ActivityEvents.TASK_COMMENT_DELETED: ActivityEvent.Categories.TASK,
    ActivityEvents.AUTOMATION_RUN: ActivityEvent.Categories.AUTOMATION,
}
EVENT_CATEGORIES.update({event_type: definition.category for event_type, definition in EVENT_DEFINITIONS.items()})


def canonical_event_type(event_type: str) -> str:
    return EVENT_ALIASES.get(event_type, event_type)


def event_label(event_type: str) -> str:
    return EVENT_LABELS.get(canonical_event_type(event_type))


def event_category(event_type: str):
    return EVENT_CATEGORIES.get(canonical_event_type(event_type))


def event_definition(event_type: str):
    return EVENT_DEFINITIONS.get(canonical_event_type(event_type))


def event_domain(event_type: str) -> str:
    definition = event_definition(event_type)
    return definition.domain if definition else ""


def is_timeline_event(event_type: str) -> bool:
    definition = event_definition(event_type)
    return bool(definition and definition.timeline)


def requires_audit_event(event_type: str) -> bool:
    return canonical_event_type(event_type) in AUDIT_REQUIRED_EVENT_TYPES
