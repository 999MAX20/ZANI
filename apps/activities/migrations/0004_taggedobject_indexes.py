from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0003_alter_taggedobject_options'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='taggedobject',
            index=models.Index(fields=['business', 'entity_type', 'tag', 'entity_id'], name='activities_tag_obj_bus_ent_tag_idx'),
        ),
    ]
