from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from apps.accounts.models import SocialIdentity, User


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
