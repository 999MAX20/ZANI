from rest_framework import serializers

from apps.leads.models import Lead
from apps.scheduling.models import Resource
from apps.services.models import Service


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)
        service = attrs.get("service") or getattr(self.instance, "service", None)
        if client and business and client.business_id != business.id:
            raise serializers.ValidationError("Client must belong to the selected business.")
        if service and business and service.business_id != business.id:
            raise serializers.ValidationError("Service must belong to the selected business.")
        return attrs


class CreateAppointmentFromLeadSerializer(serializers.Serializer):
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.all())
    resource = serializers.PrimaryKeyRelatedField(queryset=Resource.objects.all(), required=False, allow_null=True)
    start_at = serializers.DateTimeField()

    def validate(self, attrs):
        lead = self.context["lead"]
        service = attrs["service"]
        resource = attrs.get("resource")
        if service.business_id != lead.business_id:
            raise serializers.ValidationError("Service must belong to lead business.")
        if resource and resource.business_id != lead.business_id:
            raise serializers.ValidationError("Resource must belong to lead business.")
        return attrs
