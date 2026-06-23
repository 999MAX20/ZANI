import re

from django.db import migrations, models


def normalize_phone(phone):
    digits = re.sub(r"\D+", "", phone or "")
    if len(digits) == 11 and digits.startswith("8"):
        digits = f"7{digits[1:]}"
    return digits


def normalize_email(email):
    return (email or "").strip().lower()


def populate_normalized_identity(apps, schema_editor):
    Client = apps.get_model("clients", "Client")
    for client in Client.objects.all().only("id", "phone", "email").iterator(chunk_size=1000):
        Client.objects.filter(id=client.id).update(
            normalized_phone=normalize_phone(client.phone),
            normalized_email=normalize_email(client.email),
        )


class Migration(migrations.Migration):

    dependencies = [
        ("clients", "0003_clientmergelog"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="normalized_email",
            field=models.EmailField(blank=True, editable=False, max_length=254),
        ),
        migrations.AddField(
            model_name="client",
            name="normalized_phone",
            field=models.CharField(blank=True, editable=False, max_length=32),
        ),
        migrations.RunPython(populate_normalized_identity, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="client",
            index=models.Index(fields=["business", "normalized_phone"], name="clients_cli_busines_ec0996_idx"),
        ),
        migrations.AddIndex(
            model_name="client",
            index=models.Index(fields=["business", "normalized_email"], name="clients_cli_busines_1999dd_idx"),
        ),
    ]
