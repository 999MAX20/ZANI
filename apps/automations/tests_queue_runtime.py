from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from apps.accounts.models import User
from apps.automations.engine import process_automation_run
from apps.automations.models import AutomationRun
from apps.businesses.models import Business, BusinessMember
from apps.tasks.models import Task


class QueueRuntimeSmokeCommandTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="queue-owner",
            email="queue-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Queue Clinic", slug="queue-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)

    def test_queue_runtime_smoke_dispatches_and_verifies_worker_result(self):
        stdout = StringIO()

        def process_immediately(*, args, queue):
            self.assertEqual(queue, "automations")
            process_automation_run(args[0])

        with patch(
            "apps.automations.management.commands.queue_runtime_smoke.process_automation_run_task.apply_async",
            side_effect=process_immediately,
        ):
            call_command(
                "queue_runtime_smoke",
                "--business-id",
                str(self.business.id),
                "--timeout",
                "2",
                "--cleanup",
                stdout=stdout,
            )

        self.assertIn("Queue runtime smoke passed", stdout.getvalue())
        self.assertFalse(AutomationRun.objects.filter(business=self.business, idempotency_key__startswith="queue-smoke:").exists())
        self.assertFalse(Task.objects.filter(business=self.business, title__startswith="ZANI queue smoke task").exists())
