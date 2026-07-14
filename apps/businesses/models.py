from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone
import uuid


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Business(TimeStampedModel):
    class BusinessTypes(models.TextChoices):
        DENTISTRY = "dentistry", "Dentistry"
        BEAUTY = "beauty", "Beauty"
        SAUNA = "sauna", "Sauna"
        AUTOSERVICE = "autoservice", "Autoservice"
        EDUCATION = "education", "Education"
        MEDICAL = "medical", "Medical"
        OTHER = "other", "Other"

    class Statuses(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        TRIAL = "trial", "Trial"
        BLOCKED = "blocked", "Blocked"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="owned_businesses")
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    business_type = models.CharField(max_length=32, choices=BusinessTypes.choices, default=BusinessTypes.OTHER)
    city = models.CharField(max_length=128, blank=True)
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    whatsapp = models.CharField(max_length=64, blank=True)
    telegram = models.CharField(max_length=64, blank=True)
    instagram = models.CharField(max_length=64, blank=True)
    timezone = models.CharField(max_length=64, default="UTC")
    language = models.CharField(max_length=16, default="ru")
    currency = models.CharField(max_length=8, default="KZT")
    legal_name = models.CharField(max_length=255, blank=True)
    tax_id = models.CharField(max_length=64, blank=True)
    invoice_email = models.EmailField(blank=True)
    brand_color = models.CharField(max_length=32, blank=True)
    brand_logo_url = models.URLField(blank=True)
    cancellation_policy = models.TextField(blank=True)
    prepayment_policy = models.TextField(blank=True)
    sla_minutes = models.PositiveIntegerField(default=120)
    booking_buffer_minutes = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.TRIAL)
    landing_id = models.CharField(max_length=128, blank=True, db_index=True)
    landing_domain = models.CharField(max_length=255, blank=True)
    landing_preview_url = models.URLField(blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["landing_id"],
                condition=~Q(landing_id=""),
                name="unique_business_landing_id",
            ),
        ]

    def __str__(self):
        return self.name


class BusinessMember(TimeStampedModel):
    class Roles(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        OPERATOR = "operator", "Operator"
        MARKETER = "marketer", "Marketer"
        ACCOUNTANT = "accountant", "Accountant"
        SUPPORT = "support", "Support"
        STAFF = "staff", "Staff"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="business_memberships")
    role = models.CharField(max_length=32, choices=Roles.choices, default=Roles.STAFF)
    business_role = models.ForeignKey(
        "BusinessRole",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["business", "user"], name="unique_business_member"),
        ]

    def __str__(self):
        return f"{self.user} in {self.business} ({self.role})"


class RolePreset(TimeStampedModel):
    key = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    permissions_json = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class BusinessRole(TimeStampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="roles")
    name = models.CharField(max_length=128)
    preset_key = models.SlugField(max_length=64, blank=True)
    description = models.TextField(blank=True)
    permissions_json = models.JSONField(default=dict, blank=True)
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["business", "name"], name="unique_business_role_name"),
        ]

    def __str__(self):
        return f"{self.business}: {self.name}"


class RolePermission(TimeStampedModel):
    class Scopes(models.TextChoices):
        NONE = "none", "None"
        OWN = "own", "Own"
        TEAM = "team", "Team"
        BUSINESS = "business", "Business"

    business_role = models.ForeignKey(BusinessRole, on_delete=models.CASCADE, related_name="permissions")
    resource = models.CharField(max_length=64)
    action = models.CharField(max_length=64)
    scope = models.CharField(max_length=32, choices=Scopes.choices, default=Scopes.BUSINESS)
    is_allowed = models.BooleanField(default=True)

    class Meta:
        ordering = ["resource", "action"]
        constraints = [
            models.UniqueConstraint(
                fields=["business_role", "resource", "action"],
                name="unique_business_role_permission",
            ),
        ]
        indexes = [
            models.Index(fields=["resource", "action", "is_allowed"]),
        ]

    def __str__(self):
        return f"{self.business_role}: {self.resource}.{self.action} ({self.scope})"


class Team(TimeStampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["business", "name"], name="unique_business_team_name"),
        ]

    def __str__(self):
        return f"{self.business}: {self.name}"


class TeamMember(TimeStampedModel):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="team_members")
    member = models.ForeignKey(BusinessMember, on_delete=models.CASCADE, related_name="team_memberships")
    is_lead = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["team", "member"], name="unique_team_member"),
        ]

    def __str__(self):
        return f"{self.member} in {self.team}"


class BusinessInvitation(TimeStampedModel):
    class Statuses(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REVOKED = "revoked", "Revoked"
        EXPIRED = "expired", "Expired"

    class DeliveryChannels(models.TextChoices):
        EMAIL = "email", "Email"
        WHATSAPP = "whatsapp", "WhatsApp"
        TELEGRAM = "telegram", "Telegram"
        MANUAL = "manual", "Manual"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    phone = models.CharField(max_length=32, blank=True)
    telegram = models.CharField(max_length=64, blank=True)
    full_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=32, choices=BusinessMember.Roles.choices, default=BusinessMember.Roles.STAFF)
    business_role = models.ForeignKey(BusinessRole, on_delete=models.SET_NULL, null=True, blank=True, related_name="invitations")
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="sent_business_invitations")
    delivery_channel = models.CharField(max_length=32, choices=DeliveryChannels.choices, default=DeliveryChannels.MANUAL)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "email", "accepted_at", "revoked_at"]),
            models.Index(fields=["token", "expires_at"]),
        ]

    def __str__(self):
        return f"{self.email} invited to {self.business}"

    @property
    def status(self):
        if self.accepted_at:
            return self.Statuses.ACCEPTED
        if self.revoked_at:
            return self.Statuses.REVOKED
        if self.expires_at <= timezone.now():
            return self.Statuses.EXPIRED
        return self.Statuses.PENDING

    @property
    def is_pending(self):
        return self.status == self.Statuses.PENDING
