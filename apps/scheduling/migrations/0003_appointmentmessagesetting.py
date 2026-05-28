from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("businesses", "0001_initial"),
        ("scheduling", "0002_appointment_archive_reason_appointment_archived_at_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="AppointmentMessageSetting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("scenario", models.CharField(choices=[("confirmation", "Confirmation"), ("reminder", "Reminder"), ("thank_you", "Thank you")], max_length=32)),
                ("label", models.CharField(max_length=120)),
                ("is_enabled", models.BooleanField(default=True)),
                ("offset_minutes", models.IntegerField()),
                ("channel_policy", models.CharField(choices=[("auto", "Auto"), ("telegram", "Telegram"), ("whatsapp", "WhatsApp"), ("email", "Email"), ("sms", "SMS"), ("system", "System")], default="auto", max_length=32)),
                ("template_text", models.TextField()),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="appointment_message_settings", to="businesses.business")),
            ],
            options={
                "ordering": ["scenario"],
                "constraints": [models.UniqueConstraint(fields=("business", "scenario"), name="unique_appointment_message_scenario")],
            },
        ),
    ]
