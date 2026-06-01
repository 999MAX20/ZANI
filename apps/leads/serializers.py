from rest_framework import serializers

from apps.clients.models import Client
from apps.clients.services import duplicate_payload, find_duplicate_clients
from apps.core.permissions import accessible_businesses
from apps.integrations.sanitization import sanitize_config
from apps.leads.models import Lead, LeadForm, LeadFormField, LeadFormSubmission, LeadFormSubmissionError
from apps.scheduling.models import Resource
from apps.services.models import Service


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "lost_at", "lost_by", "previous_status", "archived_at", "archived_by"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)
        service = attrs.get("service") or getattr(self.instance, "service", None)
        if client and business and client.business_id != business.id:
            raise serializers.ValidationError("Client must belong to the selected business.")
        if service and business and service.business_id != business.id:
            raise serializers.ValidationError("Service must belong to the selected business.")
        responsible_user = attrs.get("responsible_user") if "responsible_user" in attrs else getattr(self.instance, "responsible_user", None)
        if responsible_user and business and not business.members.filter(user=responsible_user, is_active=True).exists():
            raise serializers.ValidationError({"responsible_user": "Responsible user must be an active business member."})
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


class LeadDuplicateCheckSerializer(serializers.Serializer):
    business = serializers.IntegerField()
    client = serializers.IntegerField(required=False, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)

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
        client = None
        if self.validated_data.get("client"):
            client = Client.objects.filter(id=self.validated_data["client"], business=business).first()
        phone = self.validated_data.get("phone") or getattr(client, "phone", "")
        email = self.validated_data.get("email") or getattr(client, "email", "")
        duplicates = find_duplicate_clients(business, phone=phone, email=email, exclude_client_id=getattr(client, "id", None))
        client_rows = duplicate_payload(duplicates, phone=phone, email=email)
        lead_rows = []
        if client:
            related_leads = Lead.objects.filter(business=business, client=client).order_by("-created_at")[:5]
            lead_rows = [
                {"id": lead.id, "client": lead.client_id, "status": lead.status, "source": lead.source, "message": lead.message}
                for lead in related_leads
            ]
        return {"duplicates": client_rows, "related_leads": lead_rows}


class LeadFormFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadFormField
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class LeadFormSerializer(serializers.ModelSerializer):
    fields = LeadFormFieldSerializer(many=True, read_only=True)
    submissions_count = serializers.IntegerField(source="submissions.count", read_only=True)

    class Meta:
        model = LeadForm
        fields = "__all__"
        read_only_fields = ["public_id", "created_at", "updated_at", "submissions_count"]


class LeadFormSubmissionSerializer(serializers.ModelSerializer):
    form_name = serializers.CharField(source="form.name", read_only=True)

    class Meta:
        model = LeadFormSubmission
        fields = "__all__"
        read_only_fields = ["created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["payload_json"] = sanitize_config(data.get("payload_json") or {})
        return data


class LeadFormSubmissionErrorSerializer(serializers.ModelSerializer):
    form_name = serializers.CharField(source="form.name", read_only=True)

    class Meta:
        model = LeadFormSubmissionError
        fields = "__all__"
        read_only_fields = ["created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["payload_json"] = sanitize_config(data.get("payload_json") or {})
        return data


class PublicLeadFormSerializer(serializers.ModelSerializer):
    fields = LeadFormFieldSerializer(many=True, read_only=True)
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = LeadForm
        fields = ["public_id", "business_name", "title", "description", "success_message", "fields"]
