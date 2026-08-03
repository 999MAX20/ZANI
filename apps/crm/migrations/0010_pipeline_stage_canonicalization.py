from django.db import migrations, models


CANONICAL_STAGES = (
    ("new", "Новая сделка", 1, "#06b6d4", 10, 60, False, False, {"new", "новая", "новая заявка", "новая сделка"}),
    ("qualification", "Квалификация", 2, "#2563eb", 30, 240, False, False, {"contacted", "связались", "в работе", "квалификация"}),
    ("proposal", "Предложение", 3, "#8b5cf6", 55, 480, False, False, {"qualified", "план лечения", "предложение"}),
    ("negotiation", "Согласование", 4, "#d97706", 75, 1440, False, False, {"booked", "запись", "согласование"}),
    ("won", "Успешно", 5, "#16a34a", 100, None, True, False, {"won", "оплачено", "выиграна", "успешно"}),
    ("lost", "Потеряно", 6, "#ef4444", 0, None, False, True, {"lost", "потеряна", "потеряно"}),
)


def _normal(value):
    return " ".join((value or "").casefold().replace("ё", "е").split())


def canonicalize_default_stages(apps, schema_editor):
    Pipeline = apps.get_model("crm", "Pipeline")
    PipelineStage = apps.get_model("crm", "PipelineStage")
    Deal = apps.get_model("crm", "Deal")

    alias_to_key = {
        _normal(alias): key
        for key, _name, _order, _color, _probability, _sla, _is_won, _is_lost, aliases in CANONICAL_STAGES
        for alias in aliases
    }
    specs = {spec[0]: spec for spec in CANONICAL_STAGES}

    for pipeline in Pipeline.objects.all().iterator():
        grouped = {}
        for stage in PipelineStage.objects.filter(pipeline=pipeline).order_by("order", "id"):
            key = stage.template_key or alias_to_key.get(_normal(stage.name))
            if key in specs:
                grouped.setdefault(key, []).append(stage)

        for key, stages in grouped.items():
            spec = specs[key]
            target = stages[0]
            for duplicate in stages[1:]:
                Deal.objects.filter(stage_id=duplicate.id).update(stage_id=target.id)
                Deal.objects.filter(previous_stage_id=duplicate.id).update(previous_stage_id=target.id)
                duplicate.name = f"{duplicate.name[:220]} [inactive #{duplicate.id}]"
                duplicate.template_key = ""
                duplicate.is_active = False
                duplicate.save(update_fields=["name", "template_key", "is_active", "updated_at"])

            (
                _key,
                name,
                order,
                color,
                probability,
                sla_minutes,
                is_won,
                is_lost,
                _aliases,
            ) = spec
            target.name = name
            target.template_key = key
            target.is_active = True
            target.order = order
            target.color = color
            target.probability = probability
            target.sla_minutes = sla_minutes
            target.is_won = is_won
            target.is_lost = is_lost
            target.save(
                update_fields=[
                    "name",
                    "template_key",
                    "is_active",
                    "order",
                    "color",
                    "probability",
                    "sla_minutes",
                    "is_won",
                    "is_lost",
                    "updated_at",
                ]
            )

        if pipeline.slug == "default-sales" or pipeline.template_key in {"onboarding_dentistry", "smb_default"}:
            pipeline.template_key = "smb_default"
            pipeline.save(update_fields=["template_key", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0009_deal_crm_deal_busines_b4fdd1_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="pipelinestage",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="pipelinestage",
            name="template_key",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.RunPython(canonicalize_default_stages, migrations.RunPython.noop),
    ]
