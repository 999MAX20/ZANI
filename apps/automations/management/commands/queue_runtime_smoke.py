import time
from uuid import uuid4

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.automations.models import AutomationAction, AutomationRule, AutomationRun
from apps.automations.tasks import process_automation_run_task
from apps.businesses.models import Business, BusinessMember
from apps.tasks.models import Task


class Command(BaseCommand):
    help = "Dispatch a safe automation run through Celery and verify that the worker processes it."

    def add_arguments(self, parser):
        parser.add_argument("--business-id", type=int, help="Existing business id to use for the smoke run.")
        parser.add_argument("--timeout", type=int, default=30, help="Seconds to wait for the Celery worker.")
        parser.add_argument("--poll-interval", type=float, default=1.0, help="Polling interval in seconds.")
        parser.add_argument("--cleanup", action="store_true", help="Delete smoke rule/run/task after a successful check.")

    def handle(self, *args, **options):
        business = self._get_business(options.get("business_id"))
        token = uuid4().hex[:12]
        title = f"ZANI queue smoke task {token}"

        with transaction.atomic():
            rule = AutomationRule.objects.create(
                business=business,
                name=f"ZANI queue smoke {token}",
                trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
                is_active=True,
                priority=9999,
            )
            AutomationAction.objects.create(
                rule=rule,
                action_type=AutomationAction.ActionTypes.CREATE_TASK,
                config={"title": title, "priority": Task.Priorities.LOW},
            )
            run = AutomationRun.objects.create(
                business=business,
                rule=rule,
                trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
                entity_type="",
                entity_id="",
                idempotency_key=f"queue-smoke:{token}",
                status=AutomationRun.Statuses.PENDING,
                payload={"smoke": True, "token": token},
                run_after=timezone.now(),
            )

        self.stdout.write(f"Created queue smoke run #{run.id} for business #{business.id}.")
        process_automation_run_task.apply_async(args=[run.id], queue="automations")
        self.stdout.write("Dispatched Celery task to queue: automations.")

        deadline = time.monotonic() + options["timeout"]
        while time.monotonic() < deadline:
            run.refresh_from_db()
            if run.status in {AutomationRun.Statuses.SUCCESS, AutomationRun.Statuses.FAILED, AutomationRun.Statuses.SKIPPED}:
                break
            time.sleep(options["poll_interval"])
        else:
            raise CommandError(
                f"Queue smoke timed out after {options['timeout']}s. "
                "Check REDIS_URL, worker process, and that a worker listens to the 'automations' queue."
            )

        run.refresh_from_db()
        if run.status != AutomationRun.Statuses.SUCCESS:
            raise CommandError(f"Queue smoke failed: run #{run.id} ended with status={run.status}, error={run.error or '-'}")

        task = Task.objects.filter(business=business, title=title).first()
        if task is None:
            raise CommandError(f"Queue smoke failed: run #{run.id} succeeded but task '{title}' was not created.")

        self.stdout.write(self.style.SUCCESS(f"Queue runtime smoke passed. Run #{run.id}, task #{task.id}."))

        if options["cleanup"]:
            task.delete()
            run.delete()
            rule.delete()
            self.stdout.write("Smoke objects cleaned up.")

    def _get_business(self, business_id):
        if business_id:
            try:
                return Business.objects.get(id=business_id)
            except Business.DoesNotExist as exc:
                raise CommandError(f"Business #{business_id} does not exist.") from exc

        owner, _ = User.objects.get_or_create(
            email="queue-smoke@zani.local",
            defaults={
                "username": "queue_smoke",
                "role": User.Roles.BUSINESS_OWNER,
                "full_name": "ZANI Queue Smoke",
                "is_active": True,
            },
        )
        if not owner.has_usable_password():
            owner.set_unusable_password()
            owner.save(update_fields=["password"])

        business, _ = Business.objects.get_or_create(
            slug="zani-queue-smoke",
            defaults={
                "owner": owner,
                "name": "ZANI Queue Smoke",
                "status": Business.Statuses.TRIAL,
                "timezone": "UTC",
            },
        )
        BusinessMember.objects.get_or_create(
            business=business,
            user=owner,
            defaults={"role": BusinessMember.Roles.OWNER, "is_active": True},
        )
        return business
