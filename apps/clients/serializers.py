from rest_framework import serializers

from apps.clients.models import Client
from apps.clients.services import duplicate_payload, find_duplicate_clients, merge_clients
from apps.core.permissions import accessible_businesses


class ClientSerializer(serializers.ModelSerializer):
    manager_user_id = serializers.IntegerField(read_only=True, allow_null=True)
    is_active = serializers.BooleanField(read_only=True)
    has_no_reply = serializers.BooleanField(read_only=True)
    is_vip = serializers.BooleanField(read_only=True)

    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "archived_at", "archived_by"]


class DuplicateCheckSerializer(serializers.Serializer):
    business = serializers.IntegerField()
    phone = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    whatsapp_id = serializers.CharField(required=False, allow_blank=True)
    telegram_id = serializers.CharField(required=False, allow_blank=True)
    instagram_id = serializers.CharField(required=False, allow_blank=True)
    exclude_client_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_business(self, value):
        request = self.context["request"]
        business = accessible_businesses(request.user).filter(id=value).first()
        if business is None and getattr(request.user, "is_platform_user", False):
            from apps.businesses.models import Business

            business = Business.objects.filter(id=value).first()
        if business is None:
            raise serializers.ValidationError("Business is not available.")
        return business

    def duplicates(self):
        business = self.validated_data["business"]
        clients = find_duplicate_clients(
            business,
            phone=self.validated_data.get("phone"),
            email=self.validated_data.get("email"),
            whatsapp_id=self.validated_data.get("whatsapp_id"),
            telegram_id=self.validated_data.get("telegram_id"),
            instagram_id=self.validated_data.get("instagram_id"),
            exclude_client_id=self.validated_data.get("exclude_client_id"),
        )
        return duplicate_payload(
            clients,
            phone=self.validated_data.get("phone"),
            email=self.validated_data.get("email"),
            whatsapp_id=self.validated_data.get("whatsapp_id"),
            telegram_id=self.validated_data.get("telegram_id"),
            instagram_id=self.validated_data.get("instagram_id"),
        )


class ClientMergeSerializer(serializers.Serializer):
    duplicate_client_id = serializers.IntegerField()

    def validate_duplicate_client_id(self, value):
        target_client = self.context["target_client"]
        duplicate = Client.objects.filter(id=value, business=target_client.business).first()
        if duplicate is None:
            raise serializers.ValidationError("Duplicate client was not found in this business.")
        if duplicate.id == target_client.id:
            raise serializers.ValidationError("Cannot merge client into itself.")
        return duplicate

    def save(self, **kwargs):
        return merge_clients(
            target_client=self.context["target_client"],
            duplicate_client=self.validated_data["duplicate_client_id"],
            actor=self.context["request"].user,
        )
