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


class BusinessCapability(TimeStampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="capabilities")
    module_key = models.CharField(max_length=32)
    is_enabled = models.BooleanField(default=True)
    configured_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="configured_business_capabilities",
    )

    class Meta:
        ordering = ["module_key"]
        constraints = [
            models.UniqueConstraint(fields=["business", "module_key"], name="unique_business_capability"),
        ]
        indexes = [models.Index(fields=["business", "module_key", "is_enabled"])]

    def __str__(self):
        return f"{self.business}: {self.module_key}={self.is_enabled}"


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
        DOCTOR = "doctor", "Doctor"

    class AvailabilityStatuses(models.TextChoices):
        AVAILABLE = "available", "Available"
        UNAVAILABLE = "unavailable", "Unavailable"

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
    availability_status = models.CharField(
        max_length=24,
        choices=AvailabilityStatuses.choices,
        default=AvailabilityStatuses.AVAILABLE,
    )
    unavailable_until = models.DateTimeField(null=True, blank=True)
    fallback_member = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fallback_for_members",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["business", "user"], name="unique_business_member"),
        ]
        indexes = [models.Index(fields=["business", "is_active", "availability_status"])]

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


class RoutingPolicy(TimeStampedModel):
    class Resources(models.TextChoices):
        LEADS = "leads", "Leads"
        CONVERSATIONS = "conversations", "Conversations"
        TASKS = "tasks", "Tasks"

    class Modes(models.TextChoices):
        MANUAL = "manual", "Manual"
        ROUND_ROBIN = "round_robin", "Round robin"
        LEAST_LOADED = "least_loaded", "Least loaded"

    class UnavailableStrategies(models.TextChoices):
        KEEP_ASSIGNED = "keep_assigned", "Keep assigned"
        MEMBER_FALLBACK = "member_fallback", "Use member fallback"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="routing_policies")
    resource = models.CharField(max_length=32, choices=Resources.choices)
    mode = models.CharField(max_length=32, choices=Modes.choices, default=Modes.MANUAL)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True, related_name="routing_policies")
    unavailable_strategy = models.CharField(
        max_length=32,
        choices=UnavailableStrategies.choices,
        default=UnavailableStrategies.KEEP_ASSIGNED,
    )
    eligible_roles = models.JSONField(default=list, blank=True)
    sla_minutes = models.PositiveIntegerField(default=30)
    last_assigned_member = models.ForeignKey(
        BusinessMember,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="last_used_by_routing_policies",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["business_id", "resource", "team_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "resource"],
                condition=Q(team__isnull=True),
                name="unique_default_routing_policy",
            ),
            models.UniqueConstraint(
                fields=["business", "resource", "team"],
                condition=Q(team__isnull=False),
                name="unique_team_routing_policy",
            ),
        ]
        indexes = [
            models.Index(fields=["business", "resource", "is_active"]),
        ]

    def __str__(self):
        scope = self.team.name if self.team_id else "business"
        return f"{self.business}: {self.resource}/{scope} ({self.mode})"


class SLAAttention(TimeStampedModel):
    class Reasons(models.TextChoices):
        UNASSIGNED = "unassigned_sla", "Unassigned SLA"
        STALE = "stale_sla", "Stale SLA"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="sla_attention_items")
    policy = models.ForeignKey(
        RoutingPolicy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sla_attention_items",
    )
    resource = models.CharField(max_length=32, choices=RoutingPolicy.Resources.choices)
    entity_id = models.CharField(max_length=64)
    reason = models.CharField(max_length=32, choices=Reasons.choices)
    is_active = models.BooleanField(default=True)
    first_detected_at = models.DateTimeField(default=timezone.now)
    last_detected_at = models.DateTimeField(default=timezone.now)
    notified_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_detected_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "resource", "entity_id", "reason"],
                name="unique_sla_attention_incident",
            ),
        ]
        indexes = [
            models.Index(fields=["business", "is_active", "last_detected_at"]),
            models.Index(fields=["resource", "is_active", "last_detected_at"]),
        ]

    def __str__(self):
        return f"{self.business_id}:{self.resource}:{self.entity_id}:{self.reason}"


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
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name="invitations")
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
