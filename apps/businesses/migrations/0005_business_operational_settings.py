from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("businesses", "0004_businessinvitation"),
    ]

    operations = [
        migrations.AddField(
            model_name="business",
            name="booking_buffer_minutes",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="business",
            name="brand_color",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="business",
            name="brand_logo_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="business",
            name="cancellation_policy",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="business",
            name="currency",
            field=models.CharField(default="KZT", max_length=8),
        ),
        migrations.AddField(
            model_name="business",
            name="invoice_email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="business",
            name="language",
            field=models.CharField(default="ru", max_length=16),
        ),
        migrations.AddField(
            model_name="business",
            name="legal_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="business",
            name="prepayment_policy",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="business",
            name="sla_minutes",
            field=models.PositiveIntegerField(default=120),
        ),
        migrations.AddField(
            model_name="business",
            name="tax_id",
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
