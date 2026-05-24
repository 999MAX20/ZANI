from __future__ import annotations

from io import StringIO

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.businesses.models import Business
from apps.leads.models import LeadForm


CAN_SHOW = [
    "Landing Start and public lead capture",
    "CRM Light: leads, clients, deals, tasks and calendar",
    "Owner cockpit and pilot readiness checklist",
    "Unified inbox foundation with website chat handoff",
    "AI recommendation -> task flow in beta/test mode",
    "Excel/CSV import templates and source onboarding",
]

DO_NOT_PROMISE = [
    "production WhatsApp/Instagram integrations",
    "marketplace repricing",
    "full loyalty/bonus ecosystem",
    "autonomous AI director",
    "guaranteed revenue analytics without merchant data",
]

PILOT_API_CHECKS = [
    "GET /health/",
    "GET /health/db/",
    "GET /ready/",
    "POST /api/auth/token/ as platform/owner/manager",
    "GET /api/auth/me/ as owner",
    "GET /api/pilot/readiness/ as owner",
    "GET /api/leads/, /api/clients/, /api/tasks/ as owner",
    "GET /api/inbox/conversations/summary/ as owner",
    "GET /api/analytics/owner-dashboard/ as owner",
    "GET /api/platform/overview/ as platform admin",
    "GET /api/public/forms/<public_id>/ without auth",
]

PILOT_FRONTEND_ROUTES = [
    "/platform",
    "/dashboard",
    "/dashboard/leads",
    "/dashboard/inbox",
    "/dashboard/ai-assistant",
    "/dashboard/integrations",
    "/dashboard/pilot-readiness",
]


class Command(BaseCommand):
    help = "Prepare a complete local/staging pilot demo launch pack with platform admin and demo merchant logins."

    def add_arguments(self, parser):
        parser.add_argument("--landing-id", default="demo-pilot-landing-001")
        parser.add_argument("--business-name", default="ZANI Demo Beauty")
        parser.add_argument("--platform-email", default="platform@zani.local")
        parser.add_argument("--platform-password", default="Platform123!")
        parser.add_argument("--owner-email", default="demo-owner@zani.local")
        parser.add_argument("--owner-password", default="DemoOwner123!")
        parser.add_argument("--manager-email", default="demo-manager@zani.local")
        parser.add_argument("--manager-password", default="DemoManager123!")
        parser.add_argument("--frontend-url", default="http://localhost:5173")
        parser.add_argument("--backend-url", default="http://127.0.0.1:8000")
        parser.add_argument("--reset", action="store_true", help="Reset and reseed the demo merchant before printing launch credentials.")
        parser.add_argument("--run-seed-output", action="store_true", help="Print the underlying seed_pilot_demo command output.")

    @transaction.atomic
    def handle(self, *args, **options):
        platform_user, platform_created = self._ensure_platform_admin(
            email=options["platform_email"],
            password=options["platform_password"],
        )

        seed_stdout = StringIO()
        call_command(
            "seed_pilot_demo",
            "--landing-id",
            options["landing_id"],
            "--business-name",
            options["business_name"],
            "--owner-email",
            options["owner_email"],
            "--owner-password",
            options["owner_password"],
            "--manager-email",
            options["manager_email"],
            "--manager-password",
            options["manager_password"],
            *(["--reset"] if options["reset"] else []),
            stdout=seed_stdout,
        )
        if options["run_seed_output"]:
            self.stdout.write(seed_stdout.getvalue().strip())

        business = Business.objects.select_related("owner").get(landing_id=options["landing_id"])
        lead_form = LeadForm.objects.filter(business=business, is_active=True).order_by("-created_at").first()

        self.stdout.write(self.style.SUCCESS("ZANI pilot demo launch is ready."))
        self.stdout.write("=" * 72)
        self.stdout.write("URLS")
        self.stdout.write(f"Frontend: {options['frontend_url']}")
        self.stdout.write(f"Backend:  {options['backend_url']}")
        self.stdout.write(f"Platform: {options['frontend_url']}/platform")
        self.stdout.write(f"Owner dashboard: {options['frontend_url']}/dashboard")
        self.stdout.write("-" * 72)
        self.stdout.write("LOGINS")
        self.stdout.write(f"Platform admin: {options['platform_email']} / {options['platform_password']}")
        self.stdout.write(f"Demo owner:     {options['owner_email']} / {options['owner_password']}")
        self.stdout.write(f"Demo manager:   {options['manager_email']} / {options['manager_password']}")
        self.stdout.write("-" * 72)
        self.stdout.write("DEMO MERCHANT")
        self.stdout.write(f"Business: {business.id} / {business.name} / {business.slug}")
        self.stdout.write(f"Landing id: {business.landing_id}")
        self.stdout.write(f"Landing domain: {business.landing_domain or 'demo.zani.local'}")
        self.stdout.write(f"Lead form public_id: {lead_form.public_id if lead_form else 'missing'}")
        if lead_form:
            public_form_url = f"{options['backend_url']}/api/public/forms/{lead_form.public_id}/"
            public_submit_url = f"{public_form_url}submit/"
            self.stdout.write(f"Public form API: {public_form_url}")
            self.stdout.write(f"Public submit API: {public_submit_url}")
        self.stdout.write("-" * 72)
        self.stdout.write("PUBLIC FORM CURL")
        if lead_form:
            self.stdout.write(
                "curl -X POST "
                f"{options['backend_url']}/api/public/forms/{lead_form.public_id}/submit/ "
                "-H 'Content-Type: application/json' "
                "-d '{\"full_name\":\"Demo Client\",\"phone\":\"+77010000099\","
                "\"message\":\"Хочу записаться\",\"utm_source\":\"demo\"}'"
            )
        else:
            self.stdout.write("Lead form is missing; run this command with --reset and check activation errors.")
        self.stdout.write("-" * 72)
        self.stdout.write("QUALITY GATE COMMANDS")
        self.stdout.write("./scripts/pilot_smoke_check.sh")
        self.stdout.write("python manage.py prepare_pilot_demo --reset")
        self.stdout.write("python manage.py pilot_launch_quality_gate")
        self.stdout.write("-" * 72)
        self.stdout.write("KEY API CHECKS")
        for item in PILOT_API_CHECKS:
            self.stdout.write(f"- {item}")
        self.stdout.write("-" * 72)
        self.stdout.write("KEY FRONTEND ROUTES")
        for route in PILOT_FRONTEND_ROUTES:
            self.stdout.write(f"- {options['frontend_url']}{route}")
        self.stdout.write("-" * 72)
        self.stdout.write("SMOKE PATH")
        self.stdout.write("1. Login as Platform admin → /platform → overview/merchants/support workflow.")
        self.stdout.write("2. Login as Demo owner → dashboard → leads → inbox → AI action → integrations.")
        self.stdout.write("3. Login as Demo manager → assigned leads/tasks/inbox handoff.")
        self.stdout.write("4. Optional: submit a public landing form using the lead_form public_id.")
        self.stdout.write("-" * 72)
        self.stdout.write("PILOT SAFE PROMISES — CAN SHOW")
        for item in CAN_SHOW:
            self.stdout.write(f"- {item}")
        self.stdout.write("PILOT SAFE PROMISES — DO NOT PROMISE")
        for item in DO_NOT_PROMISE:
            self.stdout.write(f"- {item}")
        self.stdout.write("=" * 72)
        self.stdout.write(f"Platform admin created: {platform_created}")
        self.stdout.write(f"Platform admin id: {platform_user.id}")

    def _ensure_platform_admin(self, *, email: str, password: str):
        username = email.split("@")[0].replace(".", "_").replace("+", "_") or "platform"
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": username,
                "role": User.Roles.PLATFORM_ADMIN,
                "full_name": "ZANI Platform Admin",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        user.username = user.username or username
        user.role = User.Roles.PLATFORM_ADMIN
        user.full_name = user.full_name or "ZANI Platform Admin"
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save(update_fields=["username", "role", "full_name", "is_staff", "is_superuser", "is_active", "password"])
        return user, created
