from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers

from apps.businesses.access import effective_permissions_for
from apps.core.permissions import accessible_businesses, user_can_access_business
from apps.mobile.models import MobileDevice, MobilePushToken, hash_mobile_secret


class MobileDevicePayloadSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=255, write_only=True)
    platform = serializers.ChoiceField(choices=MobileDevice.Platforms.choices)
    app_version = serializers.CharField(required=False, allow_blank=True, max_length=32)
    build_number = serializers.CharField(required=False, allow_blank=True, max_length=32)
    os_version = serializers.CharField(required=False, allow_blank=True, max_length=64)
    device_model = serializers.CharField(required=False, allow_blank=True, max_length=128)


class MobileLoginSerializer(MobileDevicePayloadSerializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    business = serializers.IntegerField(required=False)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["email"].strip().lower(),
            password=attrs["password"],
        )
        if not user or not user.is_active:
            raise serializers.ValidationError({"detail": "Invalid credentials."})
        business = resolve_mobile_business(user, attrs.get("business"))
        attrs["user"] = user
        attrs["business_obj"] = business
        return attrs


class MobileRefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField(write_only=True)


class MobileLogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True, write_only=True)


class MobileDeviceRegisterSerializer(MobileDevicePayloadSerializer):
    business = serializers.IntegerField()

    def validate(self, attrs):
        business = resolve_mobile_business(self.context["request"].user, attrs["business"])
        attrs["business_obj"] = business
        return attrs


class MobilePushTokenRegisterSerializer(serializers.Serializer):
    business = serializers.IntegerField()
    device_id = serializers.CharField(max_length=255, write_only=True)
    provider = serializers.ChoiceField(choices=MobilePushToken.Providers.choices)
    push_token = serializers.CharField(max_length=512, write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user
        business = resolve_mobile_business(user, attrs["business"])
        device_hash = hash_mobile_secret(attrs["device_id"], namespace="mobile-device")
        device = MobileDevice.objects.filter(
            business=business,
            user=user,
            device_id_hash=device_hash,
            revoked_at__isnull=True,
        ).first()
        if not device:
            raise serializers.ValidationError({"device_id": "Active mobile device was not found."})
        attrs["business_obj"] = business
        attrs["device"] = device
        attrs["token_hash"] = hash_mobile_secret(attrs["push_token"], namespace="mobile-push")
        return attrs


class MobileDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MobileDevice
        fields = [
            "id",
            "business",
            "platform",
            "app_version",
            "build_number",
            "os_version",
            "device_model",
            "last_seen_at",
            "revoked_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class MobilePushTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = MobilePushToken
        fields = [
            "id",
            "business",
            "device",
            "provider",
            "is_active",
            "last_seen_at",
            "revoked_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


def resolve_mobile_business(user, business_id=None):
    businesses = accessible_businesses(user)
    if business_id:
        business = businesses.filter(id=business_id).first()
        if not business or not user_can_access_business(user, business):
            raise serializers.ValidationError({"business": "Business is not available for this user."})
        return business
    business = businesses.first()
    if not business:
        raise serializers.ValidationError({"business": "No active business is available for this user."})
    return business


def compact_business_payload(user, business):
    return {
        "id": business.id,
        "name": business.name,
        "slug": business.slug,
        "business_type": business.business_type,
        "city": business.city,
        "timezone": business.timezone,
        "language": business.language,
        "currency": business.currency,
        "status": business.status,
        "permissions": effective_permissions_for(user, business),
    }


def upsert_mobile_device(*, user, business, attrs, ip_address=""):
    device_hash = hash_mobile_secret(attrs["device_id"], namespace="mobile-device")
    device, _ = MobileDevice.objects.update_or_create(
        business=business,
        user=user,
        device_id_hash=device_hash,
        defaults={
            "platform": attrs["platform"],
            "app_version": attrs.get("app_version", ""),
            "build_number": attrs.get("build_number", ""),
            "os_version": attrs.get("os_version", ""),
            "device_model": attrs.get("device_model", ""),
            "last_seen_at": timezone.now(),
            "last_ip": ip_address or None,
            "revoked_at": None,
            "revoked_reason": "",
        },
    )
    return device
