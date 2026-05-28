from django.conf import settings
from django.utils import timezone
from rest_framework.permissions import BasePermission


def is_platform_admin(user):
    return bool(user and user.is_authenticated and (user.is_superuser or user.role == "platform_admin"))


def platform_admin_has_global_access(user):
    return is_platform_admin(user) and not settings.SUPPORT_REQUIRES_GRANT


def is_platform_user(user):
    return bool(user and user.is_authenticated and getattr(user, "is_platform_user", False))


def accessible_businesses(user):
    from apps.businesses.models import Business
    from apps.core.models import SupportAccessGrant

    if platform_admin_has_global_access(user):
        return Business.objects.all()

    owned_query = Business.objects.filter(owner=user)
    membership_query = Business.objects.filter(members__user=user, members__is_active=True)
    support_query = Business.objects.filter(
        support_access_grants__user=user,
        support_access_grants__is_active=True,
        support_access_grants__expires_at__gt=timezone.now(),
    )
    return (owned_query | membership_query | support_query).distinct()


def user_can_access_business(user, business):
    if platform_admin_has_global_access(user):
        return True
    if not user or not user.is_authenticated or business is None:
        return False
    return (
        business.owner_id == user.id or
        business.members.filter(user=user, is_active=True).exists()
        or business.support_access_grants.filter(user=user, is_active=True, expires_at__gt=timezone.now()).exists()
    )


class IsTenantMember(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        business = getattr(obj, "business", None)

        if business is None and obj.__class__.__name__ == "Business":
            business = obj
        if business is None and hasattr(obj, "conversation"):
            business = obj.conversation.business
        if business is None and hasattr(obj, "bot"):
            business = obj.bot.business

        return user_can_access_business(request.user, business)


class IsPlatformUser(BasePermission):
    def has_permission(self, request, view):
        return is_platform_user(request.user)


class IsPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_platform_admin(request.user)
