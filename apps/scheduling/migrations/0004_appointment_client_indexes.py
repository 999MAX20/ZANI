from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scheduling', '0003_appointmentmessagesetting'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='appointment',
            index=models.Index(fields=['business', 'client', 'is_archived'], name='sched_appoint_busi_client_arch_idx'),
        ),
    ]
