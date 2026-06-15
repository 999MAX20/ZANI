from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0004_deal_archive_reason_deal_archived_at_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='deal',
            index=models.Index(fields=['business', 'client', 'is_archived'], name='crm_deal_busi_client_arch_idx'),
        ),
    ]
