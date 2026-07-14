from copy import deepcopy

from apps.tasks.models import Task


TASK_TEMPLATE_DEFINITIONS = [
    {
        "key": "call_client",
        "title": "Call client",
        "description": "Contact the client and record the next step in CRM.",
        "priority": Task.Priorities.NORMAL,
        "due_in_hours": 2,
        "reminder_offset_minutes": 30,
        "relation_hints": ["client"],
    },
    {
        "key": "qualify_lead",
        "title": "Qualify lead",
        "description": "Check client need, budget, timing and preferred service.",
        "priority": Task.Priorities.HIGH,
        "due_in_hours": 1,
        "reminder_offset_minutes": 15,
        "relation_hints": ["lead", "conversation"],
    },
    {
        "key": "send_offer",
        "title": "Send offer",
        "description": "Prepare and send the offer, then update the deal next action.",
        "priority": Task.Priorities.NORMAL,
        "due_in_hours": 4,
        "reminder_offset_minutes": 60,
        "relation_hints": ["deal", "client"],
    },
    {
        "key": "confirm_appointment",
        "title": "Confirm appointment",
        "description": "Confirm the booking details with the client before the visit.",
        "priority": Task.Priorities.HIGH,
        "due_in_hours": 3,
        "reminder_offset_minutes": 30,
        "relation_hints": ["appointment", "client"],
    },
    {
        "key": "recover_no_show",
        "title": "Recover no-show",
        "description": "Contact the client after a missed appointment and propose a new slot.",
        "priority": Task.Priorities.HIGH,
        "due_in_hours": 2,
        "reminder_offset_minutes": 30,
        "relation_hints": ["appointment", "lead", "client"],
    },
    {
        "key": "payment_follow_up",
        "title": "Payment follow-up",
        "description": "Check payment status and agree the next step with the client.",
        "priority": Task.Priorities.NORMAL,
        "due_in_hours": 24,
        "reminder_offset_minutes": 120,
        "relation_hints": ["deal", "client"],
    },
]


def task_templates_payload():
    return deepcopy(TASK_TEMPLATE_DEFINITIONS)
