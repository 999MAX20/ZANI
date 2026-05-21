from rest_framework import serializers

from apps.accounts.models import User
from apps.businesses.access import effective_permissions_for, get_membership
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
        businesses = accessible_businesses(obj)
        return BusinessSerializer(businesses, many=True).data

    def get_memberships(self, obj):
        businesses = accessible_businesses(obj)
        result = []
        for business in businesses:
            membership = get_membership(obj, business)
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
        businesses = accessible_businesses(obj)
        return {
            str(business.id): effective_permissions_for(obj, business)
            for business in businesses
        }
