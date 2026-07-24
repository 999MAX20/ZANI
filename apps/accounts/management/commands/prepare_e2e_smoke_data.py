from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.billing.models import Subscription, SubscriptionPlan
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember
from apps.crm.services import ensure_default_pipeline
from apps.onboarding.services import apply_niche_template, create_demo_data, create_first_channel_message, setup_first_channel
from apps.scheduling.models import Appointment, Resource


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
        manager = self._upsert_user(
            email="business_manager@example.com",
            password=password,
            role=User.Roles.BUSINESS_MANAGER,
            full_name="Zani Business Manager",
        )
        operator = self._upsert_user(
            email="business_operator@example.com",
            password=password,
            role=User.Roles.BUSINESS_OPERATOR,
            full_name="Zani Business Operator",
        )
        doctor = self._upsert_user(
            email="business_doctor@example.com",
            password=password,
            role=User.Roles.BUSINESS_OPERATOR,
            full_name="Zani Business Doctor",
        )
        other_doctor = self._upsert_user(
            email="business_doctor_other@example.com",
            password=password,
            role=User.Roles.BUSINESS_OPERATOR,
            full_name="Zani Business Doctor Two",
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
        self._upsert_member(business, manager, BusinessMember.Roles.MANAGER)
        self._upsert_member(business, operator, BusinessMember.Roles.OPERATOR)
        self._upsert_member(business, doctor, BusinessMember.Roles.DOCTOR)
        self._upsert_member(
            business,
            other_doctor,
            BusinessMember.Roles.DOCTOR,
        )

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
        self._prepare_doctor_appointments(
            business=business,
            doctor=doctor,
            other_doctor=other_doctor,
        )
        setup_first_channel(business, actor=owner)
        create_first_channel_message(business, actor=owner)

        self.stdout.write(
            self.style.SUCCESS(
                "Prepared E2E smoke data: "
                "platform_admin@example.com, business_owner@example.com, "
                "business_manager@example.com, business_operator@example.com, "
                "business_doctor@example.com"
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

    def _prepare_doctor_appointments(
        self,
        *,
        business,
        doctor,
        other_doctor,
    ):
        demo_appointment = business.appointments.order_by("id").first()
        if demo_appointment is None:
            return

        doctor_resource, _ = Resource.objects.update_or_create(
            business=business,
            name="E2E Doctor Schedule",
            defaults={
                "resource_type": Resource.ResourceTypes.STAFF,
                "linked_user": doctor,
                "is_active": True,
            },
        )
        other_resource, _ = Resource.objects.update_or_create(
            business=business,
            name="E2E Other Doctor Schedule",
            defaults={
                "resource_type": Resource.ResourceTypes.STAFF,
                "linked_user": other_doctor,
                "is_active": True,
            },
        )
        demo_appointment.resource = other_resource
        demo_appointment.save(update_fields=["resource", "updated_at"])

        own_appointment = Appointment.objects.filter(
            business=business,
            notes="E2E doctor-owned appointment.",
        ).first()
        own_defaults = {
            "client": demo_appointment.client,
            "lead": demo_appointment.lead,
            "service": demo_appointment.service,
            "resource": doctor_resource,
            "start_at": demo_appointment.start_at + timedelta(hours=4),
            "end_at": demo_appointment.end_at + timedelta(hours=4),
            "status": Appointment.Statuses.CREATED,
            "source": Appointment.Sources.MANUAL,
            "notes": "E2E doctor-owned appointment.",
            "is_archived": False,
            "archived_at": None,
            "archived_by": None,
            "archive_reason": "",
        }
        if own_appointment is None:
            Appointment.objects.create(business=business, **own_defaults)
            return
        for field, value in own_defaults.items():
            setattr(own_appointment, field, value)
        own_appointment.save(
            update_fields=[*own_defaults.keys(), "updated_at"],
        )
