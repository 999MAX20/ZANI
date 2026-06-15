from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0004_leadformsubmissionerror_leadform_landing_domain_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='lead',
            index=models.Index(fields=['business', 'client', 'is_archived'], name='lead_lead_busi_client_arch_idx'),
        ),
    ]
