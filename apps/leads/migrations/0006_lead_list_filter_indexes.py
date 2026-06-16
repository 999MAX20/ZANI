from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0005_lead_client_indexes"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="lead",
            index=models.Index(fields=["business", "source", "is_archived"], name="lead_busi_source_arch_idx"),
        ),
        migrations.AddIndex(
            model_name="lead",
            index=models.Index(fields=["business", "responsible_user", "status"], name="lead_busi_resp_status_idx"),
        ),
        migrations.AddIndex(
            model_name="lead",
            index=models.Index(fields=["business", "created_at"], name="lead_busi_created_idx"),
        ),
        migrations.AddIndex(
            model_name="lead",
            index=models.Index(fields=["business", "updated_at"], name="lead_busi_updated_idx"),
        ),
    ]
