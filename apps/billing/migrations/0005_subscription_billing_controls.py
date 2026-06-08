from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0004_update_default_entitlement_limits"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscription",
            name="billing_email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="subscription",
            name="invoice_details_json",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="subscription",
            name="payment_method",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="subscription",
            name="plan_change_requested_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="subscription",
            name="requested_plan",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="requested_subscriptions", to="billing.subscriptionplan"),
        ),
    ]
