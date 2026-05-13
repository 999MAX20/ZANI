import uuid

from django.db import migrations, models


def populate_public_ids(apps, schema_editor):
    BotChannel = apps.get_model("bots", "BotChannel")
    BotConversation = apps.get_model("bots", "BotConversation")

    for channel in BotChannel.objects.filter(public_token__isnull=True):
        channel.public_token = uuid.uuid4()
        channel.save(update_fields=["public_token"])

    for conversation in BotConversation.objects.filter(public_id__isnull=True):
        conversation.public_id = uuid.uuid4()
        conversation.save(update_fields=["public_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("bots", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="botchannel",
            name="public_token",
            field=models.UUIDField(default=None, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="botconversation",
            name="public_id",
            field=models.UUIDField(default=None, editable=False, null=True),
        ),
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="botchannel",
            name="public_token",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="botconversation",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
