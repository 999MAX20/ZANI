from django.conf import settings
from django.db import models


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
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.TRIAL)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class BusinessMember(TimeStampedModel):
    class Roles(models.TextChoices):
        OWNER = "owner", "Owner"
        MANAGER = "manager", "Manager"
        STAFF = "staff", "Staff"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="business_memberships")
    role = models.CharField(max_length=32, choices=Roles.choices, default=Roles.STAFF)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["business", "user"], name="unique_business_member"),
        ]

    def __str__(self):
        return f"{self.user} in {self.business} ({self.role})"
