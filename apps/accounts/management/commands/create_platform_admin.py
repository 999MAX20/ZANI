from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Create or update an idempotent Zani platform admin user."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)
        parser.add_argument("--full-name", default="Zani Platform Admin")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        full_name = options["full_name"].strip()

        if not email:
            raise CommandError("--email cannot be empty.")
        if len(password) < 8:
            raise CommandError("--password must contain at least 8 characters.")

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email,
                "full_name": full_name,
                "role": User.Roles.PLATFORM_ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        user.username = user.username or email
        user.full_name = full_name or user.full_name
        user.role = User.Roles.PLATFORM_ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save(update_fields=["username", "full_name", "role", "is_staff", "is_superuser", "password"])

        action = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{action} platform admin: {email}"))
