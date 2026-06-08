from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_importjob_errors_json_alter_importjob_entity_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="customfielddefinition",
            name="permissions_json",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
