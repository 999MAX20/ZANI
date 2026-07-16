from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0004_notificationpreference"),
    ]

    operations = [
        migrations.AddField(
            model_name="notificationpreference",
            name="push_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="notificationpreference",
            name="privacy_mode",
            field=models.CharField(
                choices=[("redacted", "Redacted"), ("full", "Full")],
                default="redacted",
                max_length=16,
            ),
        ),
    ]
