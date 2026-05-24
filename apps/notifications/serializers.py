from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    recipient_email = serializers.EmailField(source="recipient.email", read_only=True)
    recipient_name = serializers.CharField(source="recipient.full_name", read_only=True)
    is_read = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
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
