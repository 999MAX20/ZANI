from django.contrib import admin

from apps.businesses.models import Business, BusinessInvitation, BusinessMember, BusinessRole, RolePermission, RolePreset, Team, TeamMember


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "business_type", "city", "status", "created_at")
    list_filter = ("business_type", "status", "city")
    search_fields = ("name", "slug", "owner__email", "phone", "whatsapp", "telegram", "instagram")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(BusinessMember)
class BusinessMemberAdmin(admin.ModelAdmin):
    list_display = ("business", "user", "role", "business_role", "is_active", "created_at")
    list_filter = ("role", "is_active")
    search_fields = ("business__name", "user__email", "user__full_name")


@admin.register(BusinessInvitation)
class BusinessInvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "business", "role", "delivery_channel", "status", "expires_at", "created_at")
    list_filter = ("role", "delivery_channel", "accepted_at", "revoked_at")
    search_fields = ("business__name", "email", "phone", "telegram", "full_name")
    readonly_fields = ("token", "accepted_at", "revoked_at", "created_at", "updated_at")


@admin.register(RolePreset)
class RolePresetAdmin(admin.ModelAdmin):
    list_display = ("key", "name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("key", "name")


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 0


@admin.register(BusinessRole)
class BusinessRoleAdmin(admin.ModelAdmin):
    list_display = ("business", "name", "preset_key", "is_system", "is_active", "created_at")
    list_filter = ("preset_key", "is_system", "is_active")
    search_fields = ("business__name", "name", "preset_key")
    inlines = [RolePermissionInline]


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("business", "name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("business__name", "name")


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ("team", "member", "is_lead", "created_at")
    list_filter = ("is_lead",)
    search_fields = ("team__name", "member__user__email", "member__user__full_name")
