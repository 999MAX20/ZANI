from django.contrib import admin

from apps.businesses.models import Business, BusinessMember


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "business_type", "city", "status", "created_at")
    list_filter = ("business_type", "status", "city")
    search_fields = ("name", "slug", "owner__email", "phone", "whatsapp", "telegram", "instagram")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(BusinessMember)
class BusinessMemberAdmin(admin.ModelAdmin):
    list_display = ("business", "user", "role", "is_active", "created_at")
    list_filter = ("role", "is_active")
    search_fields = ("business__name", "user__email", "user__full_name")
