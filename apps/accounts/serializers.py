from django.db.models import Prefetch
from rest_framework import serializers

from apps.accounts.models import SocialIdentity, User, UserPreference
from apps.businesses.access import effective_permissions_for, owner_business_role, user_is_business_owner
from apps.businesses.capabilities import capability_payload
from apps.businesses.models import BusinessMember
from apps.businesses.serializers import BusinessSerializer
from apps.core.permissions import accessible_businesses


class CurrentUserSerializer(serializers.ModelSerializer):
    is_platform_user = serializers.BooleanField(read_only=True)
    is_merchant_user = serializers.BooleanField(read_only=True)
    is_business_manager = serializers.BooleanField(read_only=True)
    businesses = serializers.SerializerMethodField()
    memberships = serializers.SerializerMethodField()
    effective_permissions = serializers.SerializerMethodField()
    preferences = serializers.SerializerMethodField()
    social_identities = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()

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
            "capabilities",
            "preferences",
            "social_identities",
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
            if user_is_business_owner(obj, business):
                business_role = owner_business_role(business)
                result.append(
                    {
                        "business": business.id,
                        "role": BusinessMember.Roles.OWNER,
                        "business_role": business_role.id if business_role else None,
                        "business_role_name": business_role.name if business_role else "",
                        "is_active": True,
                    }
                )
                continue
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
        return {str(business.id): effective_permissions_for(obj, business) for business in businesses}

    def get_capabilities(self, obj):
        return {str(business.id): capability_payload(business) for business in self._get_businesses(obj)}

    def get_preferences(self, obj):
        preferences, _ = UserPreference.objects.get_or_create(user=obj)
        return UserPreferenceSerializer(preferences).data

    def get_social_identities(self, obj):
        return SocialIdentitySummarySerializer(obj.social_identities.all(), many=True).data

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


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        fields = ["language", "timezone", "start_page", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class SocialIdentitySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialIdentity
        fields = ["provider", "email", "email_verified", "created_at", "updated_at"]


class CurrentUserUpdateSerializer(serializers.ModelSerializer):
    preferences = UserPreferenceSerializer(required=False)

    class Meta:
        model = User
        fields = ["full_name", "phone", "preferences"]

    def update(self, instance, validated_data):
        preferences_data = validated_data.pop("preferences", None)
        instance = super().update(instance, validated_data)
        if preferences_data is not None:
            preferences, _ = UserPreference.objects.get_or_create(user=instance)
            for field, value in preferences_data.items():
                setattr(preferences, field, value)
            preferences.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


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
