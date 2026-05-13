from django.db import migrations


DEFAULT_STAGES = [
    ("New", "#06b6d4", 10, 60, False, False),
    ("Contacted", "#2563eb", 25, 240, False, False),
    ("Qualified", "#8b5cf6", 50, 480, False, False),
    ("Booked", "#22c55e", 80, None, False, False),
    ("Won", "#16a34a", 100, None, True, False),
    ("Lost", "#ef4444", 0, None, False, True),
]


def create_default_pipelines(apps, schema_editor):
    Business = apps.get_model("businesses", "Business")
    Pipeline = apps.get_model("crm", "Pipeline")
    PipelineStage = apps.get_model("crm", "PipelineStage")

    for business in Business.objects.all():
        pipeline, _ = Pipeline.objects.get_or_create(
            business=business,
            slug="default-sales",
            defaults={
                "name": "Sales pipeline",
                "entity_type": "deal",
                "is_default": True,
                "template_key": "smb_default",
            },
        )
        for order, (name, color, probability, sla_minutes, is_won, is_lost) in enumerate(DEFAULT_STAGES, start=1):
            PipelineStage.objects.get_or_create(
                business=business,
                pipeline=pipeline,
                name=name,
                defaults={
                    "order": order,
                    "color": color,
                    "probability": probability,
                    "sla_minutes": sla_minutes,
                    "is_won": is_won,
                    "is_lost": is_lost,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ("businesses", "0001_initial"),
        ("crm", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_default_pipelines, migrations.RunPython.noop),
    ]
