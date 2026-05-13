from django.utils.text import slugify

from apps.businesses.models import Business
from apps.crm.models import Pipeline, PipelineStage


DEFAULT_STAGES = [
    ("New", "#06b6d4", 10, 60),
    ("Contacted", "#2563eb", 25, 240),
    ("Qualified", "#8b5cf6", 50, 480),
    ("Booked", "#22c55e", 80, None),
    ("Won", "#16a34a", 100, None),
    ("Lost", "#ef4444", 0, None),
]


def ensure_default_pipeline(business: Business) -> Pipeline:
    pipeline, _ = Pipeline.objects.get_or_create(
        business=business,
        slug="default-sales",
        defaults={
            "name": "Sales pipeline",
            "entity_type": Pipeline.EntityTypes.DEAL,
            "is_default": True,
            "template_key": "smb_default",
        },
    )
    for order, (name, color, probability, sla_minutes) in enumerate(DEFAULT_STAGES, start=1):
        PipelineStage.objects.get_or_create(
            business=business,
            pipeline=pipeline,
            name=name,
            defaults={
                "order": order,
                "color": color,
                "probability": probability,
                "sla_minutes": sla_minutes,
                "is_won": slugify(name) == "won",
                "is_lost": slugify(name) == "lost",
            },
        )
    return pipeline

