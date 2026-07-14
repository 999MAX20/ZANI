from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clients", "0004_client_normalized_identity"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="source_detail",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="client",
            name="source_context_json",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
