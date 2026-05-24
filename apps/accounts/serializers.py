from django.db.models import Prefetch
from rest_framework import serializers

from apps.accounts.models import User
from apps.businesses.access import PERMISSION_CATALOG, ROLE_PRESETS, Actions, normalize_role
from apps.businesses.models import BusinessMember, RolePermission
from apps.businesses.serializers import BusinessSerializer
from apps.core.permissions import accessible_businesses


class CurrentUserSerializer(serializers.ModelSerializer):
    is_platform_user = serializers.BooleanField(read_only=True)
    is_merchant_user = serializers.BooleanField(read_only=True)
    is_business_manager = serializers.BooleanField(read_only=True)
    businesses = serializers.SerializerMethodField()
    memberships = serializers.SerializerMethodField()
    effective_permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "phone",
            "role",
            "is_platform_user",
            "is_merchant_user",
            "is_business_manager",
            "businesses",
            "memberships",
            "effective_permissions",
        ]

    def get_businesses(self, obj):
        if obj.is_platform_user and not obj.is_merchant_user:
            return []
        businesses = self._get_businesses(obj)
        return BusinessSerializer(businesses, many=True).data

    def get_memberships(self, obj):
        result = []
        for business in self._get_businesses(obj):
            membership = self._membership_for(business)
            if not membership:
                continue
            result.append(
                {
                    "business": business.id,
                    "role": membership.role,
                    "business_role": membership.business_role_id,
                    "business_role_name": membership.business_role.name if membership.business_role else "",
                    "is_active": membership.is_active,
                }
            )
        return result

    def get_effective_permissions(self, obj):
        businesses = self._get_businesses(obj)
        memberships = [self._membership_for(business) for business in businesses]
        memberships = [membership for membership in memberships if membership]
        role_ids = [membership.business_role_id for membership in memberships if membership.business_role_id]
        role_permissions = self._role_permissions(role_ids)
        return {str(membership.business_id): self._permissions_for_membership(membership, role_permissions) for membership in memberships}

    def _get_businesses(self, obj):
        if hasattr(self, "_cached_businesses"):
            return self._cached_businesses
        queryset = accessible_businesses(obj).select_related("owner").prefetch_related(
            Prefetch(
                "members",
                queryset=BusinessMember.objects.select_related("business_role").filter(user=obj, is_active=True),
                to_attr="_current_user_memberships",
            )
        )
        self._cached_businesses = list(queryset)
        return self._cached_businesses

    def _membership_for(self, business):
        memberships = getattr(business, "_current_user_memberships", None)
        if memberships is not None:
            return memberships[0] if memberships else None
        return (
            BusinessMember.objects.select_related("business_role")
            .filter(business=business, user=self.instance, is_active=True)
            .first()
        )

    def _role_permissions(self, role_ids):
        if not role_ids:
            return {}
        permissions = RolePermission.objects.filter(business_role_id__in=role_ids).only(
            "business_role_id",
            "resource",
            "action",
            "scope",
            "is_allowed",
        )
        return {(permission.business_role_id, permission.resource, permission.action): permission for permission in permissions}

    def _permissions_for_membership(self, membership, role_permissions):
        result = []
        for resource, actions in PERMISSION_CATALOG.items():
            for action in actions:
                scope = self._permission_scope(membership, role_permissions, resource, action)
                if scope and scope != RolePermission.Scopes.NONE:
                    result.append({"resource": resource, "action": action, "scope": scope})
        return result

    def _permission_scope(self, membership, role_permissions, resource, action):
        business_role = membership.business_role
        if business_role and business_role.is_active:
            permission = role_permissions.get((business_role.id, resource, action))
            if permission is None and action != Actions.MANAGE:
                permission = role_permissions.get((business_role.id, resource, Actions.MANAGE))
            if permission is not None:
                return permission.scope if permission.is_allowed else RolePermission.Scopes.NONE

        role = normalize_role(membership.role)
        permissions = ROLE_PRESETS.get(role, {})
        if "*" in permissions:
            return permissions["*"].get(action) or permissions["*"].get(Actions.MANAGE)
        resource_permissions = permissions.get(resource, {})
        return resource_permissions.get(action) or resource_permissions.get(Actions.MANAGE)


class SocialAuthSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=["google", "apple"])
    id_token = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    delivery_channel = serializers.ChoiceField(choices=["email", "whatsapp", "telegram", "manual"], default="email")


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(min_length=8, write_only=True)


class OwnerSignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    full_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    business_name = serializers.CharField(max_length=255)
    business_type = serializers.ChoiceField(
        choices=["dentistry", "beauty", "sauna", "autoservice", "education", "medical", "other"],
        default="other",
    )
    city = serializers.CharField(required=False, allow_blank=True, max_length=128)
