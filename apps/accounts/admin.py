from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from apps.accounts.models import MfaChallenge, MfaDevice, MfaRecoveryCode, SocialIdentity, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("email", "full_name", "phone", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
    search_fields = ("email", "full_name", "phone", "username")
    ordering = ("email",)
    fieldsets = UserAdmin.fieldsets + (
        ("Platform profile", {"fields": ("phone", "full_name", "role")}),
    )


@admin.register(SocialIdentity)
class SocialIdentityAdmin(admin.ModelAdmin):
    list_display = ("provider", "email", "user", "email_verified", "created_at")
    list_filter = ("provider", "email_verified")
    search_fields = ("email", "subject", "user__email", "user__full_name")
    readonly_fields = ("created_at", "updated_at")


class ReadonlySecurityAdmin(admin.ModelAdmin):
    """Expose operational metadata without allowing admin-side security bypasses."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MfaDevice)
class MfaDeviceAdmin(ReadonlySecurityAdmin):
    list_display = ("user", "confirmed_at", "last_used_counter", "updated_at")
    search_fields = ("user__email", "user__full_name")
    fields = ("user", "confirmed_at", "last_used_counter", "created_at", "updated_at")
    readonly_fields = fields


@admin.register(MfaRecoveryCode)
class MfaRecoveryCodeAdmin(ReadonlySecurityAdmin):
    list_display = ("user", "used_at", "created_at")
    search_fields = ("user__email",)
    fields = ("user", "used_at", "created_at")
    readonly_fields = fields


@admin.register(MfaChallenge)
class MfaChallengeAdmin(ReadonlySecurityAdmin):
    list_display = ("user", "purpose", "expires_at", "consumed_at", "failed_attempts")
    list_filter = ("purpose",)
    search_fields = ("user__email",)
    fields = ("id", "user", "purpose", "expires_at", "consumed_at", "failed_attempts", "created_at")
    readonly_fields = fields
