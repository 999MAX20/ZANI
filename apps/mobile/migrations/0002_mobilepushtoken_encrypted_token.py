from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("mobile", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="mobilepushtoken",
            name="encrypted_token",
            field=models.TextField(blank=True),
        ),
    ]
