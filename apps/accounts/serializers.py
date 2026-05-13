from rest_framework import serializers

from apps.accounts.models import User
from apps.businesses.serializers import BusinessSerializer
from apps.core.permissions import accessible_businesses


class CurrentUserSerializer(serializers.ModelSerializer):
    is_platform_user = serializers.BooleanField(read_only=True)
    is_merchant_user = serializers.BooleanField(read_only=True)
    is_business_manager = serializers.BooleanField(read_only=True)
    businesses = serializers.SerializerMethodField()

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
        ]

    def get_businesses(self, obj):
        if obj.is_platform_user and not obj.is_merchant_user:
            return []
        businesses = accessible_businesses(obj)
        return BusinessSerializer(businesses, many=True).data
