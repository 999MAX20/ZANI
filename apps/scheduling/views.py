from datetime import datetime, time, timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.businesses.access import Actions, Resources, assert_can
from apps.core.crm_cards import appointment_crm_card
from apps.core.idempotency import IdempotentCRMCreateMixin
from apps.core.permissions import user_can_access_business
from apps.core.viewsets import TenantModelViewSet
from apps.businesses.models import Business
from apps.scheduling.models import Appointment, AppointmentMessageSetting, Resource, WorkingHours
from apps.scheduling.serializers import (
    AppointmentMessageSettingSerializer,
    AppointmentRescheduleSerializer,
    AppointmentSerializer,
    AppointmentStatusReasonSerializer,
    AvailableSlotSerializer,
    ResourceSerializer,
    WorkingHoursSerializer,
)
from apps.scheduling.services import (
    apply_working_hours_preset,
    cancel_appointment,
    complete_appointment,
    confirm_appointment,
    ensure_appointment_message_settings,
    get_available_slots,
    handle_appointment_created,
    mark_appointment_no_show,
    reschedule_appointment,
    sync_appointment_after_update,
    validate_appointment_availability,
)
from apps.services.models import Service


def _business_zone(business):
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo(business.timezone)
    except Exception:
        return timezone.get_current_timezone()


def _parse_range_boundary(value, *, business, end_of_date=False):
    if not value:
        return None
    parsed_datetime = parse_datetime(value)
    if parsed_datetime is not None:
        if timezone.is_naive(parsed_datetime):
            return timezone.make_aware(parsed_datetime, _business_zone(business))
        return parsed_datetime
    parsed_date = parse_date(value)
    if parsed_date is None:
        raise ValidationError("start_from and start_to must be ISO datetime or YYYY-MM-DD.")
    boundary_time = time.min
    boundary = datetime.combine(parsed_date, boundary_time)
    return timezone.make_aware(boundary, _business_zone(business))


class ResourceViewSet(TenantModelViewSet):
    queryset = Resource.objects.select_related("business", "linked_user")
    serializer_class = ResourceSerializer

    def get_access_resource(self):
        if self.action in {"list", "retrieve"}:
            return Resources.APPOINTMENTS
        return Resources.SETTINGS

    def get_access_action(self):
        if self.action in {"list", "retrieve"}:
            return Actions.VIEW
        return Actions.UPDATE


class WorkingHoursViewSet(TenantModelViewSet):
    queryset = WorkingHours.objects.select_related("business", "resource")
    serializer_class = WorkingHoursSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        business_id = self.request.query_params.get("business")
        resource_id = self.request.query_params.get("resource")
        if business_id:
            queryset = queryset.filter(business_id=business_id)
        if resource_id:
            queryset = queryset.filter(resource_id=resource_id)
        return queryset

    def get_access_resource(self):
        if self.action in {"list", "retrieve"}:
            return Resources.APPOINTMENTS
        return Resources.SETTINGS

    def get_access_action(self):
        if self.action in {"list", "retrieve"}:
            return Actions.VIEW
        return Actions.UPDATE

    @action(detail=False, methods=["post"], url_path="apply-preset")
    def apply_preset(self, request):
        business_id = request.data.get("business")
        preset = request.data.get("preset")
        resource_id = request.data.get("resource")

        if not business_id or not preset:
            raise ValidationError("business and preset are required.")

        business = Business.objects.filter(id=business_id).first()
        if not business or not user_can_access_business(request.user, business):
            raise ValidationError("Business is not available.")
        assert_can(request.user, business, Resources.SETTINGS, Actions.UPDATE)

        resource = None
        if resource_id:
            resource = Resource.objects.filter(id=resource_id, business=business).first()
            if not resource:
                raise ValidationError("Resource is not available.")

        try:
            working_hours = apply_working_hours_preset(business, preset, resource=resource)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        serializer = self.get_serializer(working_hours, many=True)
        return Response({"preset": preset, "count": len(working_hours), "results": serializer.data})

    @action(detail=False, methods=["post"], url_path="bulk-upsert-week")
    def bulk_upsert_week(self, request):
        business_id = request.data.get("business")
        resource_id = request.data.get("resource")
        days = request.data.get("days")

        if not business_id or not isinstance(days, list):
            raise ValidationError("business and days are required.")

        business = Business.objects.filter(id=business_id).first()
        if not business or not user_can_access_business(request.user, business):
            raise ValidationError("Business is not available.")
        assert_can(request.user, business, Resources.SETTINGS, Actions.UPDATE)

        resource = None
        if resource_id:
            resource = Resource.objects.filter(id=resource_id, business=business).first()
            if not resource:
                raise ValidationError("Resource is not available.")

        weekdays = [day.get("weekday") for day in days if isinstance(day, dict)]
        if len(days) != len(weekdays):
            raise ValidationError("Each day must be an object.")
        if len(set(weekdays)) != len(weekdays):
            raise ValidationError("Duplicate weekdays are not allowed.")

        serializers = []
        for day in days:
            existing = WorkingHours.objects.filter(
                business=business,
                resource=resource,
                weekday=day.get("weekday"),
            ).first()
            payload = {
                "business": business.id,
                "resource": resource.id if resource else None,
                "weekday": day.get("weekday"),
                "start_time": day.get("start_time"),
                "end_time": day.get("end_time"),
                "is_day_off": day.get("is_day_off", False),
            }
            serializer = self.get_serializer(existing, data=payload)
            serializer.is_valid(raise_exception=True)
            serializers.append(serializer)

        with transaction.atomic():
            working_hours = [serializer.save() for serializer in serializers]

        serializer = self.get_serializer(working_hours, many=True)
        return Response({"count": len(working_hours), "results": serializer.data})


class AppointmentMessageSettingViewSet(TenantModelViewSet):
    queryset = AppointmentMessageSetting.objects.select_related("business")
    serializer_class = AppointmentMessageSettingSerializer
    access_resource = Resources.SETTINGS

    def list(self, request, *args, **kwargs):
        business_id = request.query_params.get("business")
        business = Business.objects.filter(id=business_id).first() if business_id else Business.objects.filter(owner=request.user).first()
        if not business or not user_can_access_business(request.user, business):
            raise ValidationError("Business is not available.")
        assert_can(request.user, business, Resources.SETTINGS, Actions.VIEW)
        settings = ensure_appointment_message_settings(business)
        serializer = self.get_serializer(settings, many=True)
        return Response(serializer.data)


class AppointmentViewSet(IdempotentCRMCreateMixin, TenantModelViewSet):
    queryset = Appointment.objects.select_related("business", "client", "lead", "lead__responsible_user", "service", "resource", "resource__linked_user")
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        business_id = self.request.query_params.get("business")
        business = None
        if business_id:
            business = Business.objects.filter(id=business_id).first()
            if not business or not user_can_access_business(self.request.user, business):
                raise ValidationError("Business is not available.")
            queryset = queryset.filter(business=business)

        service_id = self.request.query_params.get("service")
        resource_id = self.request.query_params.get("resource")
        status = self.request.query_params.get("status")
        if service_id:
            queryset = queryset.filter(service_id=service_id)
        if resource_id:
            queryset = queryset.filter(resource_id=resource_id)
        if status:
            queryset = queryset.filter(status=status)

        start_from = self.request.query_params.get("start_from")
        start_to = self.request.query_params.get("start_to")
        if start_from or start_to:
            if business is None:
                raise ValidationError("business is required when filtering appointments by date range.")
            from_boundary = _parse_range_boundary(start_from, business=business) if start_from else None
            to_boundary = _parse_range_boundary(start_to, business=business) if start_to else None
            if from_boundary:
                queryset = queryset.filter(end_at__gt=from_boundary)
            if to_boundary:
                queryset = queryset.filter(start_at__lt=to_boundary)

        client_ids = self.parse_query_id_list("client_ids")
        if client_ids:
            queryset = queryset.filter(client_id__in=client_ids)
        lead_ids = self.parse_query_id_list("lead_ids")
        if lead_ids:
            queryset = queryset.filter(lead_id__in=lead_ids)
        return queryset

    def perform_create(self, serializer):
        business = serializer.validated_data["business"]
        with transaction.atomic():
            Business.objects.select_for_update().get(pk=business.pk)
            try:
                serializer.validated_data["end_at"] = validate_appointment_availability(
                    business,
                    serializer.validated_data["service"],
                    serializer.validated_data["start_at"],
                    resource=serializer.validated_data.get("resource"),
                )
            except ValueError as exc:
                raise ValidationError(str(exc)) from exc
            super().perform_create(serializer)
        handle_appointment_created(serializer.instance)

    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        previous_start_at = serializer.instance.start_at
        previous_service_id = serializer.instance.service_id
        previous_resource_id = serializer.instance.resource_id
        super().perform_update(serializer)
        sync_appointment_after_update(
            appointment=serializer.instance,
            actor=self.request.user,
            previous_status=previous_status,
            previous_start_at=previous_start_at,
            previous_service_id=previous_service_id,
            previous_resource_id=previous_resource_id,
        )

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        appointment = self.get_object()
        assert_can(request.user, appointment.business, Resources.APPOINTMENTS, Actions.UPDATE, obj=appointment)
        try:
            appointment = confirm_appointment(appointment=appointment, actor=request.user)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        assert_can(request.user, appointment.business, Resources.APPOINTMENTS, Actions.UPDATE, obj=appointment)
        serializer = AppointmentStatusReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            appointment = cancel_appointment(
                appointment=appointment,
                actor=request.user,
                reason=serializer.validated_data["reason"],
                request=request,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        appointment = self.get_object()
        assert_can(request.user, appointment.business, Resources.APPOINTMENTS, Actions.UPDATE, obj=appointment)
        try:
            appointment = complete_appointment(appointment=appointment, actor=request.user, request=request)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=["post"], url_path="no-show")
    def no_show(self, request, pk=None):
        appointment = self.get_object()
        assert_can(request.user, appointment.business, Resources.APPOINTMENTS, Actions.UPDATE, obj=appointment)
        serializer = AppointmentStatusReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            appointment = mark_appointment_no_show(
                appointment=appointment,
                actor=request.user,
                reason=serializer.validated_data["reason"],
                request=request,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=["post"])
    def reschedule(self, request, pk=None):
        appointment = self.get_object()
        assert_can(request.user, appointment.business, Resources.APPOINTMENTS, Actions.UPDATE, obj=appointment)
        serializer = AppointmentRescheduleSerializer(data=request.data, context={"appointment": appointment})
        serializer.is_valid(raise_exception=True)
        try:
            appointment = reschedule_appointment(
                appointment=appointment,
                actor=request.user,
                start_at=serializer.validated_data["start_at"],
                resource=serializer.validated_data.get("resource", appointment.resource),
                reason=serializer.validated_data.get("reason", ""),
                request=request,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        return Response(self.get_serializer(appointment).data)

    @action(detail=False, methods=["get"], url_path="available-slots")
    def available_slots(self, request):
        business_id = request.query_params.get("business_id")
        service_id = request.query_params.get("service_id")
        resource_id = request.query_params.get("resource_id")
        exclude_appointment_id = request.query_params.get("exclude_appointment_id")
        date_value = request.query_params.get("date")

        if not business_id or not service_id or not date_value:
            raise ValidationError("business_id, service_id and date are required.")

        business = Business.objects.filter(id=business_id).first()
        if not business or not user_can_access_business(request.user, business):
            raise ValidationError("Business is not available.")

        service = Service.objects.filter(id=service_id, business=business).first()
        if not service:
            raise ValidationError("Service is not available.")

        resource = None
        if resource_id:
            resource = Resource.objects.filter(id=resource_id, business=business).first()
            if not resource:
                raise ValidationError("Resource is not available.")

        exclude_appointment = None
        if exclude_appointment_id:
            exclude_appointment = Appointment.objects.filter(id=exclude_appointment_id, business=business).first()
            if not exclude_appointment:
                raise ValidationError("Appointment to exclude is not available.")

        try:
            slot_date = datetime.strptime(date_value, "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValidationError("date must be YYYY-MM-DD.") from exc

        slots = get_available_slots(business, service, slot_date, resource=resource, exclude_appointment=exclude_appointment)
        payload = [
            {"start_at": slot, "end_at": slot + timedelta(minutes=service.duration_minutes)}
            for slot in slots
        ]
        return Response(AvailableSlotSerializer(payload, many=True).data)

    @action(detail=True, methods=["get"], url_path="crm-card")
    def crm_card(self, request, pk=None):
        appointment = self.get_object()
        return Response(appointment_crm_card(appointment, actor=request.user))
