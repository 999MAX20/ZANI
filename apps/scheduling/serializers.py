from rest_framework import serializers

from apps.scheduling.models import Appointment, Resource, WorkingHours
from apps.scheduling.services import validate_appointment_availability


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "archived_at", "archived_by"]


class WorkingHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkingHours
        fields = "__all__"

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        resource = attrs.get("resource") or getattr(self.instance, "resource", None)
        start_time = attrs.get("start_time") or getattr(self.instance, "start_time", None)
        end_time = attrs.get("end_time") or getattr(self.instance, "end_time", None)
        if resource and business and resource.business_id != business.id:
            raise serializers.ValidationError("Resource must belong to the selected business.")
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError("start_time must be before end_time.")
        if business is not None and attrs.get("weekday", getattr(self.instance, "weekday", None)) is not None:
            weekday = attrs.get("weekday", getattr(self.instance, "weekday", None))
            duplicate_query = WorkingHours.objects.filter(business=business, resource=resource, weekday=weekday)
            if self.instance is not None:
                duplicate_query = duplicate_query.exclude(pk=self.instance.pk)
            if duplicate_query.exists():
                target = "resource" if resource else "business"
                raise serializers.ValidationError(f"Working hours for this {target} and weekday already exist.")
        return attrs


class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]
        extra_kwargs = {"end_at": {"required": False}}

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)
        lead = attrs.get("lead") or getattr(self.instance, "lead", None)
        service = attrs.get("service") or getattr(self.instance, "service", None)
        resource = attrs.get("resource") or getattr(self.instance, "resource", None)
        start_at = attrs.get("start_at") or getattr(self.instance, "start_at", None)
        end_at = attrs.get("end_at") or getattr(self.instance, "end_at", None)

        related = [client, lead, service, resource]
        if any(obj and obj.business_id != business.id for obj in related):
            raise serializers.ValidationError("All related objects must belong to the selected business.")
        if start_at and end_at and start_at >= end_at:
            raise serializers.ValidationError("start_at must be before end_at.")
        if start_at and service and business:
            try:
                calculated_end = validate_appointment_availability(
                    business,
                    service,
                    start_at,
                    resource=resource,
                    exclude_appointment=self.instance,
                )
            except ValueError as exc:
                raise serializers.ValidationError(str(exc)) from exc
            attrs["end_at"] = calculated_end
        return attrs


class AvailableSlotSerializer(serializers.Serializer):
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
