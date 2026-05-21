from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.billing.models import Subscription, SubscriptionPlan
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember
from apps.crm.services import ensure_default_pipeline
from apps.onboarding.services import apply_niche_template, create_demo_data, create_first_channel_message, setup_first_channel


class Command(BaseCommand):
    help = "Create or update deterministic smoke-test users and demo CRM data."

    def add_arguments(self, parser):
        parser.add_argument("--password", default="ZaniTest123!")
        parser.add_argument("--business-slug", default="zani-e2e-demo")
        parser.add_argument("--business-name", default="Zani E2E Demo")

    @transaction.atomic
    def handle(self, *args, **options):
        password = options["password"]
        if len(password) < 8:
            raise CommandError("--password must contain at least 8 characters.")

        platform_admin = self._upsert_user(
            email="platform_admin@example.com",
            password=password,
            role=User.Roles.PLATFORM_ADMIN,
            full_name="Zani Platform Admin",
            is_staff=True,
            is_superuser=True,
        )
        owner = self._upsert_user(
            email="business_owner@example.com",
            password=password,
            role=User.Roles.BUSINESS_OWNER,
            full_name="Zani Business Owner",
        )
        operator = self._upsert_user(
            email="business_operator@example.com",
            password=password,
            role=User.Roles.BUSINESS_OPERATOR,
            full_name="Zani Business Operator",
        )

        business, _ = Business.objects.update_or_create(
            slug=options["business_slug"],
            defaults={
                "owner": owner,
                "name": options["business_name"],
                "business_type": Business.BusinessTypes.DENTISTRY,
                "city": "Almaty",
                "phone": "+77010000000",
                "timezone": "Asia/Almaty",
                "status": Business.Statuses.ACTIVE,
            },
        )
        self._upsert_member(business, owner, BusinessMember.Roles.OWNER)
        self._upsert_member(business, operator, BusinessMember.Roles.OPERATOR)

        ensure_default_roles(business)
        ensure_default_pipeline(business)
        plan = SubscriptionPlan.objects.filter(code="growth").first()
        if plan:
            Subscription.objects.update_or_create(
                business=business,
                defaults={"plan": plan, "status": Subscription.Statuses.ACTIVE},
            )

        apply_niche_template(business, Business.BusinessTypes.DENTISTRY, actor=owner)
        create_demo_data(business, actor=owner)
        setup_first_channel(business, actor=owner)
        create_first_channel_message(business, actor=owner)

        self.stdout.write(
            self.style.SUCCESS(
                "Prepared E2E smoke data: "
                "platform_admin@example.com, business_owner@example.com, business_operator@example.com"
            )
        )

    def _upsert_user(self, *, email, password, role, full_name, is_staff=False, is_superuser=False):
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email,
                "full_name": full_name,
                "role": role,
                "is_staff": is_staff,
                "is_superuser": is_superuser,
            },
        )
        user.username = user.username or email
        user.full_name = full_name
        user.role = role
        user.is_staff = is_staff
        user.is_superuser = is_superuser
        user.is_active = True
        user.set_password(password)
        user.save(update_fields=["username", "full_name", "role", "is_staff", "is_superuser", "is_active", "password"])
        return user

    def _upsert_member(self, business, user, role):
        member, _ = BusinessMember.objects.update_or_create(
            business=business,
            user=user,
            defaults={"role": role, "is_active": True},
        )
        return member
