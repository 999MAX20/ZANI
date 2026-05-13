from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from apps.accounts.models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("email", "full_name", "phone", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
    search_fields = ("email", "full_name", "phone", "username")
    ordering = ("email",)
    fieldsets = UserAdmin.fieldsets + (
        ("Platform profile", {"fields": ("phone", "full_name", "role")}),
    )
