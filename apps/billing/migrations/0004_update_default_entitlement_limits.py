from django.db import migrations


PLAN_LIMITS = {
    "start": {
        "businesses": 1,
        "users": 3,
        "bots": 1,
        "automations": 3,
        "ai_requests": 0,
        "bot_messages": 100,
        "conversations": 50,
        "storage_mb": 100,
    },
    "growth": {
        "businesses": 1,
        "users": 10,
        "bots": 5,
        "automations": 25,
        "ai_requests": 1000,
        "bot_messages": 5000,
        "conversations": 1500,
        "storage_mb": 2048,
    },
    "platform": {
        "businesses": 10,
        "users": 50,
        "bots": 25,
        "automations": 250,
        "ai_requests": 10000,
        "bot_messages": 50000,
        "conversations": 15000,
        "storage_mb": 10240,
    },
}


def update_limits(apps, schema_editor):
    SubscriptionPlan = apps.get_model("billing", "SubscriptionPlan")
    for code, limits in PLAN_LIMITS.items():
        plan = SubscriptionPlan.objects.filter(code=code).first()
        if plan is None:
            continue
        current = plan.limits_json or {}
        plan.limits_json = {**limits, **current}
        plan.save(update_fields=["limits_json", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0003_usagecounter"),
    ]

    operations = [
        migrations.RunPython(update_limits, migrations.RunPython.noop),
    ]
