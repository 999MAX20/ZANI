from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0004_taskcomment_task_completed_by_task_parent_task_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='task',
            index=models.Index(fields=['business', 'client', 'is_archived'], name='tasks_task_busi_client_arch_idx'),
        ),
    ]
