from apps.activities.models import ActivityEvent


class ActivityEvents:
    CLIENT_CREATED = "client_created"
    CLIENT_UPDATED = "client_updated"
    CLIENT_MERGED = "client_merged"

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

    DEAL_CREATED = "deal_created"
    DEAL_CREATED_FROM_LEAD = "deal_created_from_lead"
    DEAL_STAGE_CHANGED = "deal_stage_changed"
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

    MESSAGE_RECEIVED = "message_received"
    MESSAGE_SENT = "message_sent"
    NOTE_CREATED = "note_created"
    AUTOMATION_RUN = "automation_run"
    DELIVERY_FAILED = "delivery_failed"


EVENT_ALIASES = {
    "deal_marked_won": ActivityEvents.DEAL_WON,
    "deal_marked_lost": ActivityEvents.DEAL_LOST,
    "lead_marked_lost": ActivityEvents.LEAD_LOST,
}


EVENT_LABELS = {
    ActivityEvents.CLIENT_CREATED: "Создан клиент",
    ActivityEvents.CLIENT_UPDATED: "Обновлён клиент",
    ActivityEvents.CLIENT_MERGED: "Клиенты объединены",
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
    ActivityEvents.DEAL_CREATED: "Создана сделка",
    ActivityEvents.DEAL_CREATED_FROM_LEAD: "Сделка создана из заявки",
    ActivityEvents.DEAL_STAGE_CHANGED: "Сделка перешла на другую стадию",
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
    ActivityEvents.MESSAGE_RECEIVED: "Получено сообщение",
    ActivityEvents.MESSAGE_SENT: "Отправлено сообщение",
    ActivityEvents.NOTE_CREATED: "Добавлена заметка",
    ActivityEvents.AUTOMATION_RUN: "Сработала автоматизация",
    ActivityEvents.DELIVERY_FAILED: "Ошибка доставки",
}


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
    ActivityEvents.AUTOMATION_RUN: ActivityEvent.Categories.AUTOMATION,
}


def canonical_event_type(event_type: str) -> str:
    return EVENT_ALIASES.get(event_type, event_type)


def event_label(event_type: str) -> str:
    return EVENT_LABELS.get(canonical_event_type(event_type))


def event_category(event_type: str):
    return EVENT_CATEGORIES.get(canonical_event_type(event_type))
