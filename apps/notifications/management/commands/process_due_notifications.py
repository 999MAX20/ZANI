from django.core.management.base import BaseCommand

from apps.notifications.delivery import process_due_notifications


class Command(BaseCommand):
    help = "Delivers pending notifications whose send_at is due."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        results = process_due_notifications(limit=options["limit"])
        sent = sum(1 for item in results if item.get("status") == "sent")
        failed = sum(1 for item in results if item.get("status") == "failed")
        skipped = sum(1 for item in results if item.get("status") == "skipped")
        self.stdout.write(self.style.SUCCESS(f"Processed {len(results)} notifications: sent={sent}, failed={failed}, skipped={skipped}"))
