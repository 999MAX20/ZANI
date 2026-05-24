from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Roles(models.TextChoices):
        PLATFORM_ADMIN = "platform_admin", "Platform admin"
        PLATFORM_MANAGER = "platform_manager", "Platform manager"
        BUSINESS_OWNER = "business_owner", "Business owner"
        BUSINESS_MANAGER = "business_manager", "Business manager"
        BUSINESS_OPERATOR = "business_operator", "Business operator"
        MANAGER = "manager", "Manager"
        STAFF = "staff", "Staff"

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)
    full_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=32, choices=Roles.choices, default=Roles.BUSINESS_OWNER)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.full_name or self.email

    @property
    def is_platform_user(self):
        return self.is_superuser or self.role in {
            self.Roles.PLATFORM_ADMIN,
            self.Roles.PLATFORM_MANAGER,
        }

    @property
    def is_merchant_user(self):
        return self.role in {
            self.Roles.BUSINESS_OWNER,
            self.Roles.BUSINESS_MANAGER,
            self.Roles.BUSINESS_OPERATOR,
            self.Roles.MANAGER,
            self.Roles.STAFF,
        }

    @property
    def is_business_manager(self):
        return self.role in {self.Roles.BUSINESS_MANAGER, self.Roles.MANAGER}


class SocialIdentity(models.Model):
    class Providers(models.TextChoices):
        GOOGLE = "google", "Google"
        APPLE = "apple", "Apple"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="social_identities")
    provider = models.CharField(max_length=32, choices=Providers.choices)
    subject = models.CharField(max_length=255)
    email = models.EmailField()
    email_verified = models.BooleanField(default=False)
    raw_claims = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["provider", "subject"], name="accounts_social_identity_provider_subject_uniq"),
        ]
        indexes = [
            models.Index(fields=["provider", "email"], name="acct_social_provider_email_idx"),
            models.Index(fields=["user", "provider"], name="acct_social_user_provider_idx"),
        ]

    def __str__(self):
        return f"{self.provider}:{self.email}"
