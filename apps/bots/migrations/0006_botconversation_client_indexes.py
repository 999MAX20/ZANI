from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bots', '0005_botconversation_archive_reason_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='botconversation',
            index=models.Index(fields=['business', 'client', 'is_archived'], name='bots_botconv_busi_client_arch_idx'),
        ),
    ]
