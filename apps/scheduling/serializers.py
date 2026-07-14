from rest_framework import serializers

from apps.scheduling.models import Appointment, AppointmentMessageSetting, Resource, WorkingHours
from apps.scheduling.services import validate_appointment_availability


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = [
            "id",
            "business",
            "name",
            "resource_type",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class WorkingHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkingHours
        fields = [
            "id",
            "business",
            "resource",
            "weekday",
            "start_time",
            "end_time",
            "is_day_off",
        ]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        resource = attrs.get("resource") or getattr(self.instance, "resource", None)
        start_time = attrs.get("start_time") or getattr(self.instance, "start_time", None)
        end_time = attrs.get("end_time") or getattr(self.instance, "end_time", None)
        if resource and business and resource.business_id != business.id:
            raise serializers.ValidationError("Resource must belong to the selected business.")
        weekday = attrs.get("weekday", getattr(self.instance, "weekday", None))
        if weekday is not None and not 0 <= weekday <= 6:
            raise serializers.ValidationError("weekday must be between 0 and 6.")
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError("start_time must be before end_time.")
        if business is not None and weekday is not None:
            duplicate_query = WorkingHours.objects.filter(business=business, resource=resource, weekday=weekday)
            if self.instance is not None:
                duplicate_query = duplicate_query.exclude(pk=self.instance.pk)
            if duplicate_query.exists():
                target = "resource" if resource else "business"
                raise serializers.ValidationError(f"Working hours for this {target} and weekday already exist.")
        return attrs


class AppointmentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    client_phone = serializers.CharField(source="client.phone", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_duration_minutes = serializers.IntegerField(source="service.duration_minutes", read_only=True)
    resource_name = serializers.CharField(source="resource.name", read_only=True, allow_null=True)
    resource_type = serializers.CharField(source="resource.resource_type", read_only=True, allow_null=True)
    lead_title = serializers.SerializerMethodField()

    lifecycle_update_fields = {"status"}
    schedule_update_fields = {"client", "lead", "service", "resource", "start_at", "end_at"}
    archive_update_fields = {"is_archived", "archive_reason", "archived_at", "archived_by"}

    class Meta:
        model = Appointment
        fields = [
            "id",
            "business",
            "client",
            "client_name",
            "client_phone",
            "lead",
            "lead_title",
            "service",
            "service_name",
            "service_duration_minutes",
            "resource",
            "resource_name",
            "resource_type",
            "start_at",
            "end_at",
            "status",
            "source",
            "notes",
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
        extra_kwargs = {"end_at": {"required": False}}

    def get_lead_title(self, obj):
        if not obj.lead_id:
            return ""
        return f"#{obj.lead_id}"

    def validate(self, attrs):
        attempted_archive_fields = sorted(self.archive_update_fields.intersection((self.initial_data or {}).keys()))
        if attempted_archive_fields:
            raise serializers.ValidationError(
                {
                    "detail": "Use appointment archive action endpoints for archive state changes.",
                    "fields": attempted_archive_fields,
                }
            )
        if self.instance is not None:
            attempted_lifecycle_fields = sorted(self.lifecycle_update_fields.intersection((self.initial_data or {}).keys()))
            if attempted_lifecycle_fields:
                raise serializers.ValidationError(
                    {
                        "detail": "Use appointment lifecycle action endpoints for protected state changes.",
                        "fields": attempted_lifecycle_fields,
                    }
                )
            attempted_schedule_fields = sorted(self.schedule_update_fields.intersection((self.initial_data or {}).keys()))
            if attempted_schedule_fields:
                raise serializers.ValidationError(
                    {
                        "detail": "Use appointment reschedule action endpoint for schedule changes.",
                        "fields": attempted_schedule_fields,
                    }
                )
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


class AppointmentRescheduleSerializer(serializers.Serializer):
    start_at = serializers.DateTimeField()
    resource = serializers.PrimaryKeyRelatedField(queryset=Resource.objects.all(), required=False, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate(self, attrs):
        appointment = self.context["appointment"]
        resource = attrs.get("resource", appointment.resource)
        if resource and resource.business_id != appointment.business_id:
            raise serializers.ValidationError("Resource must belong to the selected business.")
        return attrs


class AppointmentStatusReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, trim_whitespace=True)


class AppointmentMessageSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentMessageSetting
        fields = [
            "id",
            "business",
            "scenario",
            "label",
            "is_enabled",
            "offset_minutes",
            "channel_policy",
            "template_text",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        offset_minutes = attrs.get("offset_minutes", getattr(self.instance, "offset_minutes", 0))
        scenario = attrs.get("scenario", getattr(self.instance, "scenario", None))
        if scenario in {AppointmentMessageSetting.Scenarios.CONFIRMATION, AppointmentMessageSetting.Scenarios.REMINDER} and offset_minutes >= 0:
            raise serializers.ValidationError("Confirmation and reminder offsets must be before appointment start.")
        if scenario == AppointmentMessageSetting.Scenarios.THANK_YOU and offset_minutes < 0:
            raise serializers.ValidationError("Thank-you offset must be after appointment end.")
        if abs(offset_minutes) > 60 * 24 * 30:
            raise serializers.ValidationError("offset_minutes is too large.")
        return attrs


class AvailableSlotSerializer(serializers.Serializer):
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
