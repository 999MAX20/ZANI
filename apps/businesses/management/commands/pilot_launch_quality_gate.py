from __future__ import annotations

from dataclasses import dataclass

from django.core.management.base import BaseCommand, CommandError
from rest_framework.test import APIClient

from apps.businesses.models import Business
from apps.leads.models import LeadForm


CLIENT_KWARGS = {"HTTP_HOST": "localhost"}


@dataclass(frozen=True)
class GateUser:
    label: str
    email: str
    password: str


class Command(BaseCommand):
    help = "Run a fast API quality gate against the prepared ZANI pilot demo merchant."

    def add_arguments(self, parser):
        parser.add_argument("--landing-id", default="demo-pilot-landing-001")
        parser.add_argument("--platform-email", default="platform@zani.local")
        parser.add_argument("--platform-password", default="Platform123!")
        parser.add_argument("--owner-email", default="demo-owner@zani.local")
        parser.add_argument("--owner-password", default="DemoOwner123!")
        parser.add_argument("--manager-email", default="demo-manager@zani.local")
        parser.add_argument("--manager-password", default="DemoManager123!")
        parser.add_argument("--operator-email", default="demo-operator@zani.local")
        parser.add_argument("--operator-password", default="DemoOperator123!")

    def handle(self, *args, **options):
        business = Business.objects.filter(landing_id=options["landing_id"]).first()
        if not business:
            raise CommandError(
                f"Pilot demo business with landing_id={options['landing_id']} was not found. "
                "Run: python manage.py prepare_pilot_demo --reset"
            )

        lead_form = LeadForm.objects.filter(business=business, is_active=True).order_by("-created_at").first()
        if not lead_form:
            raise CommandError("Pilot demo has no active lead form.")

        client = APIClient()
        self._check_public(client, "health", "/health/")
        self._check_public(client, "health db", "/health/db/")
        self._check_public(client, "readiness", "/ready/")
        self._check_public(client, "public lead form", f"/api/public/forms/{lead_form.public_id}/")

        platform = GateUser("platform admin", options["platform_email"], options["platform_password"])
        owner = GateUser("demo owner", options["owner_email"], options["owner_password"])
        manager = GateUser("demo manager", options["manager_email"], options["manager_password"])
        operator = GateUser("demo operator", options["operator_email"], options["operator_password"])

        platform_token = self._login(platform)
        owner_token = self._login(owner)
        manager_token = self._login(manager)
        operator_token = self._login(operator)

        self._check_authenticated("platform overview", "/api/platform/overview/", platform_token)
        self._check_authenticated("owner me", "/api/auth/me/", owner_token)
        self._check_authenticated("owner pilot readiness", "/api/pilot/readiness/", owner_token)
        self._check_authenticated("owner leads", "/api/leads/", owner_token)
        self._check_authenticated("owner clients", "/api/clients/", owner_token)
        self._check_authenticated("owner tasks", "/api/tasks/", owner_token)
        self._check_authenticated("owner inbox summary", "/api/inbox/conversations/summary/", owner_token)
        self._check_authenticated("owner analytics", f"/api/analytics/owner-dashboard/?business={business.id}", owner_token)
        self._check_authenticated("manager me", "/api/auth/me/", manager_token)
        self._check_authenticated("manager tasks", "/api/tasks/", manager_token)
        self._check_authenticated("operator me", "/api/auth/me/", operator_token)
        self._check_authenticated("operator tasks", "/api/tasks/", operator_token)
        self._check_authenticated("operator inbox summary", "/api/inbox/conversations/summary/", operator_token)

        self.stdout.write(self.style.SUCCESS("Pilot launch quality gate passed."))
        self.stdout.write(f"Business: {business.id} / {business.name}")
        self.stdout.write(f"Lead form public_id: {lead_form.public_id}")

    def _login(self, user: GateUser) -> str:
        client = APIClient()
        response = client.post(
            "/api/auth/token/",
            {"email": user.email, "password": user.password},
            format="json",
            **CLIENT_KWARGS,
        )
        if response.status_code != 200:
            raise CommandError(f"Login failed for {user.label} ({user.email}): HTTP {response.status_code}")
        token = response.data.get("access")
        if not token:
            raise CommandError(f"Login for {user.label} did not return an access token.")
        self.stdout.write(f"[PASS] login: {user.label}")
        return token

    def _check_public(self, client: APIClient, label: str, path: str) -> None:
        response = client.get(path, **CLIENT_KWARGS)
        if response.status_code >= 400:
            raise CommandError(f"{label} failed: GET {path} returned HTTP {response.status_code}")
        self.stdout.write(f"[PASS] {label}: GET {path}")

    def _check_authenticated(self, label: str, path: str, token: str) -> None:
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = client.get(path, **CLIENT_KWARGS)
        if response.status_code >= 400:
            raise CommandError(f"{label} failed: GET {path} returned HTTP {response.status_code}")
        self.stdout.write(f"[PASS] {label}: GET {path}")
