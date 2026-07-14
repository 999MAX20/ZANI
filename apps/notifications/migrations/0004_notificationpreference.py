from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("businesses", "0004_businessinvitation"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("notifications", "0003_notification_recipient"),
    ]

    operations = [
        migrations.CreateModel(
            name="NotificationPreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("category", models.CharField(choices=[("sales", "Sales"), ("finance", "Finance"), ("system", "System"), ("ai_alerts", "AI alerts"), ("outreach", "Outreach"), ("tasks", "Tasks")], max_length=32)),
                ("in_app_enabled", models.BooleanField(default=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notification_preferences", to="businesses.business")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notification_preferences", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["category"],
            },
        ),
        migrations.AddIndex(
            model_name="notificationpreference",
            index=models.Index(fields=["business", "user", "category"], name="notificatio_busines_8a6c5c_idx"),
        ),
        migrations.AddConstraint(
            model_name="notificationpreference",
            constraint=models.UniqueConstraint(fields=("business", "user", "category"), name="unique_notification_preference_per_user_category"),
        ),
    ]
