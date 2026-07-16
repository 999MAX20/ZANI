from django.db import migrations, models
from django.utils import timezone


def backfill_response_due_at(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    for lead in Lead.objects.select_related("business").filter(response_due_at__isnull=True).iterator():
        sla_minutes = getattr(lead.business, "sla_minutes", 120) or 120
        lead.response_due_at = lead.created_at + timezone.timedelta(minutes=sla_minutes)
        lead.save(update_fields=["response_due_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("leads", "0007_remove_lead_lead_lead_busi_client_arch_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="lead",
            name="first_responded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="lead",
            name="response_due_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_response_due_at, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="lead",
            index=models.Index(fields=["business", "status", "response_due_at"], name="lead_biz_status_due_idx"),
        ),
    ]
