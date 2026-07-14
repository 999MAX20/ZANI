from rest_framework import serializers

from apps.notifications.models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    recipient_email = serializers.EmailField(source="recipient.email", read_only=True)
    recipient_name = serializers.CharField(source="recipient.full_name", read_only=True)
    is_read = serializers.BooleanField(read_only=True)
    protected_state_fields = {"status", "read_at"}

    class Meta:
        model = Notification
        fields = [
            "id",
            "business",
            "recipient",
            "recipient_email",
            "recipient_name",
            "client",
            "client_name",
            "appointment",
            "channel",
            "category",
            "priority",
            "text",
            "send_at",
            "status",
            "action_url",
            "action_label",
            "read_at",
            "is_read",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["status", "read_at", "is_read", "created_at", "updated_at"]

    def validate(self, attrs):
        attempted_state_fields = sorted(self.protected_state_fields.intersection((self.initial_data or {}).keys()))
        if attempted_state_fields:
            raise serializers.ValidationError(
                {
                    "detail": "Use notification action endpoints for delivery/read state changes.",
                    "fields": attempted_state_fields,
                }
            )
        business = attrs.get("business") or getattr(self.instance, "business", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)
        appointment = attrs.get("appointment") or getattr(self.instance, "appointment", None)
        recipient = attrs.get("recipient") or getattr(self.instance, "recipient", None)
        if client and business and client.business_id != business.id:
            raise serializers.ValidationError("Client must belong to the selected business.")
        if appointment and business and appointment.business_id != business.id:
            raise serializers.ValidationError("Appointment must belong to the selected business.")
        if recipient and business and not business.members.filter(user=recipient, is_active=True).exists():
            raise serializers.ValidationError("Recipient must be an active member of the selected business.")
        return attrs


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = NotificationPreference
        fields = [
            "id",
            "business",
            "user",
            "user_email",
            "user_name",
            "category",
            "in_app_enabled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        user = attrs.get("user") or getattr(self.instance, "user", None)
        if user and business and not business.members.filter(user=user, is_active=True).exists() and business.owner_id != user.id:
            raise serializers.ValidationError("User must be an active member of the selected business.")
        return attrs
