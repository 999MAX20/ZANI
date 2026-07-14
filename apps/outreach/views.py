from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.businesses.access import Actions
from apps.businesses.models import BusinessMember
from apps.clients.models import Client
from apps.core.file_validation import validate_file_upload
from apps.core.permissions import accessible_businesses
from apps.core.viewsets import TenantModelViewSet
from apps.outreach.imports import read_consent_upload
from apps.outreach.models import OutreachCampaign, OutreachConsent, OutreachRecipient, OutreachTemplate
from apps.outreach.serializers import OutreachCampaignSerializer, OutreachConsentSerializer, OutreachRecipientSerializer, OutreachTemplateSerializer
from apps.outreach.services import appointment_automation_status, campaign_launch_checklist, campaign_stats, launch_campaign, prepare_campaign_recipients, preview_campaign_audience, refresh_campaign_status, retry_failed_recipients


OUTREACH_MANAGE_ROLES = {BusinessMember.Roles.OWNER, BusinessMember.Roles.ADMIN, BusinessMember.Roles.MARKETER}
OUTREACH_LAUNCH_ROLES = {BusinessMember.Roles.OWNER, BusinessMember.Roles.ADMIN, BusinessMember.Roles.MARKETER}


class OutreachTemplateViewSet(TenantModelViewSet):
    queryset = OutreachTemplate.objects.select_related("business", "created_by")
    serializer_class = OutreachTemplateSerializer
    access_resource = "notifications"

    def perform_create(self, serializer):
        _assert_outreach_role(self.request.user, serializer.validated_data.get("business"), OUTREACH_MANAGE_ROLES)
        serializer.validated_data["created_by"] = self.request.user
        serializer.save()

    def perform_update(self, serializer):
        _assert_outreach_role(self.request.user, serializer.validated_data.get("business") or serializer.instance.business, OUTREACH_MANAGE_ROLES)
        serializer.save()


class OutreachCampaignViewSet(TenantModelViewSet):
    queryset = OutreachCampaign.objects.select_related("business", "segment", "template", "created_by").annotate(
        recipients_total=Count("recipients", distinct=True),
        recipients_pending=Count("recipients", filter=Q(recipients__status__in=[OutreachRecipient.Statuses.QUEUED, OutreachRecipient.Statuses.PENDING]), distinct=True),
        recipients_sent=Count("recipients", filter=Q(recipients__status=OutreachRecipient.Statuses.SENT), distinct=True),
        recipients_failed=Count("recipients", filter=Q(recipients__status=OutreachRecipient.Statuses.FAILED), distinct=True),
        recipients_skipped=Count("recipients", filter=Q(recipients__status=OutreachRecipient.Statuses.SKIPPED), distinct=True),
    )
    serializer_class = OutreachCampaignSerializer
    access_resource = "notifications"
    action_permission_map = {
        **TenantModelViewSet.action_permission_map,
        "preview_audience": Actions.VIEW,
        "prepare": Actions.MANAGE,
        "launch": Actions.MANAGE,
        "refresh_status": Actions.VIEW,
        "stats": Actions.VIEW,
        "launch_checklist": Actions.VIEW,
        "appointment_automation_status": Actions.VIEW,
        "retry_failed": Actions.MANAGE,
        "cancel": Actions.MANAGE,
    }

    def perform_create(self, serializer):
        _assert_outreach_role(self.request.user, serializer.validated_data.get("business"), OUTREACH_MANAGE_ROLES)
        serializer.validated_data["created_by"] = self.request.user
        serializer.save()

    def perform_update(self, serializer):
        _assert_outreach_role(self.request.user, serializer.validated_data.get("business") or serializer.instance.business, OUTREACH_MANAGE_ROLES)
        serializer.save()

    @action(detail=True, methods=["get"], url_path="preview-audience")
    def preview_audience(self, request, pk=None):
        campaign = self.get_object()
        return Response(preview_campaign_audience(campaign))

    @action(detail=True, methods=["post"])
    def prepare(self, request, pk=None):
        campaign = self.get_object()
        _assert_outreach_role(request.user, campaign.business, OUTREACH_MANAGE_ROLES)
        try:
            result = prepare_campaign_recipients(campaign, client_ids=request.data.get("client_ids"))
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response({"campaign": OutreachCampaignSerializer(campaign, context={"request": request}).data, **result})

    @action(detail=True, methods=["post"])
    def launch(self, request, pk=None):
        campaign = self.get_object()
        _assert_outreach_role(request.user, campaign.business, OUTREACH_LAUNCH_ROLES)
        try:
            result = launch_campaign(campaign)
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response({"campaign": OutreachCampaignSerializer(campaign, context={"request": request}).data, **result})

    @action(detail=True, methods=["post"], url_path="refresh-status")
    def refresh_status(self, request, pk=None):
        campaign = self.get_object()
        counts = refresh_campaign_status(campaign)
        return Response({"campaign": OutreachCampaignSerializer(campaign, context={"request": request}).data, "counts": counts})

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        campaign = self.get_object()
        return Response(campaign_stats(campaign))

    @action(detail=True, methods=["get"], url_path="launch-checklist")
    def launch_checklist(self, request, pk=None):
        campaign = self.get_object()
        return Response(campaign_launch_checklist(campaign))

    @action(detail=False, methods=["get"], url_path="appointment-automation-status")
    def appointment_automation_status(self, request):
        business = _resolve_accessible_business(request)
        return Response(appointment_automation_status(business))

    @action(detail=True, methods=["post"], url_path="retry-failed")
    def retry_failed(self, request, pk=None):
        campaign = self.get_object()
        _assert_outreach_role(request.user, campaign.business, OUTREACH_LAUNCH_ROLES)
        try:
            result = retry_failed_recipients(
                campaign,
                retryable_only=str(request.data.get("retryable_only", "")).lower() in {"1", "true", "yes"},
                delay_minutes=int(request.data.get("delay_minutes") or 0),
            )
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response({"campaign": OutreachCampaignSerializer(campaign, context={"request": request}).data, **result})

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        campaign = self.get_object()
        _assert_outreach_role(request.user, campaign.business, OUTREACH_LAUNCH_ROLES)
        campaign.status = OutreachCampaign.Statuses.CANCELLED
        campaign.save(update_fields=["status", "updated_at"])
        campaign.recipients.filter(status__in=[OutreachRecipient.Statuses.QUEUED, OutreachRecipient.Statuses.PENDING]).update(status=OutreachRecipient.Statuses.CANCELLED)
        return Response(OutreachCampaignSerializer(campaign, context={"request": request}).data)


class OutreachRecipientViewSet(TenantModelViewSet):
    queryset = OutreachRecipient.objects.select_related("business", "campaign", "client", "notification")
    serializer_class = OutreachRecipientSerializer
    access_resource = "notifications"

    def get_queryset(self):
        queryset = super().get_queryset()
        campaign_id = self.request.query_params.get("campaign")
        status_filter = self.request.query_params.get("status")
        if campaign_id:
            queryset = queryset.filter(campaign_id=campaign_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset


class OutreachConsentViewSet(TenantModelViewSet):
    queryset = OutreachConsent.objects.select_related("business", "client")
    serializer_class = OutreachConsentSerializer
    access_resource = "notifications"
    action_permission_map = {
        **TenantModelViewSet.action_permission_map,
        "bulk_import": Actions.MANAGE,
        "bulk_import_file": Actions.MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        client_id = self.request.query_params.get("client")
        channel = self.request.query_params.get("channel")
        status_filter = self.request.query_params.get("status")
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if channel:
            queryset = queryset.filter(channel=channel)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def get_parser_classes(self):
        if getattr(self, "action", "") == "bulk_import_file":
            return [MultiPartParser, FormParser]
        return [JSONParser]

    def perform_create(self, serializer):
        _assert_outreach_role(self.request.user, serializer.validated_data.get("business"), OUTREACH_MANAGE_ROLES)
        serializer.save()

    def perform_update(self, serializer):
        _assert_outreach_role(self.request.user, serializer.validated_data.get("business") or serializer.instance.business, OUTREACH_MANAGE_ROLES)
        serializer.save()

    @action(detail=False, methods=["post"], url_path="bulk-import")
    def bulk_import(self, request):
        business_id = request.data.get("business")
        channel = request.data.get("channel")
        status_value = request.data.get("status") or OutreachConsent.Statuses.OPTED_IN
        source = request.data.get("source") or "manual_import"
        rows = request.data.get("rows") or []
        if not isinstance(rows, list):
            raise ValidationError({"rows": "Rows must be a list."})

        business = self._resolve_business_for_import(business_id)
        _assert_outreach_role(request.user, business, OUTREACH_MANAGE_ROLES)
        result = self._import_rows(business=business, rows=rows, default_channel=channel, default_status=status_value, default_source=source)
        return Response(result)

    @action(detail=False, methods=["post"], url_path="bulk-import-file")
    def bulk_import_file(self, request):
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "File is required."})
        validate_file_upload(
            upload,
            allowed_extensions=["csv", "xlsx"],
            allowed_content_types=[
                "text/csv",
                "application/csv",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
        )
        business = self._resolve_business_for_import(request.data.get("business"))
        _assert_outreach_role(request.user, business, OUTREACH_MANAGE_ROLES)
        rows = read_consent_upload(upload)
        result = self._import_rows(
            business=business,
            rows=rows,
            default_channel=request.data.get("channel"),
            default_status=request.data.get("status") or OutreachConsent.Statuses.OPTED_IN,
            default_source=request.data.get("source") or "file_import",
            filename=getattr(upload, "name", ""),
        )
        return Response(result)

    def _import_rows(self, *, business, rows, default_channel, default_status, default_source, filename=""):
        if default_channel and default_channel not in OutreachConsent.Channels.values:
            raise ValidationError({"channel": "Unsupported channel."})
        if default_status and default_status not in OutreachConsent.Statuses.values:
            raise ValidationError({"status": "Unsupported status."})
        imported = 0
        skipped = []
        now = timezone.now()
        for index, row in enumerate(rows):
            if not isinstance(row, dict):
                skipped.append({"index": index, "reason": "Row must be an object."})
                continue
            channel = row.get("channel") or default_channel
            status_value = row.get("status") or default_status
            source = row.get("source") or default_source
            if channel not in OutreachConsent.Channels.values:
                skipped.append({"index": index, "reason": "Unsupported channel.", "row": row})
                continue
            if status_value not in OutreachConsent.Statuses.values:
                skipped.append({"index": index, "reason": "Unsupported status.", "row": row})
                continue
            client = self._find_client(business, row)
            if client is None:
                skipped.append({"index": index, "reason": "Client was not found.", "row": row})
                continue
            defaults = {
                "status": status_value,
                "source": str(source or ""),
                "note": str(row.get("note") or ""),
                "evidence_json": {"import_row": row, "imported_by": self.request.user.id, "filename": filename},
            }
            if status_value == OutreachConsent.Statuses.OPTED_IN:
                defaults["opted_in_at"] = now
                defaults["opted_out_at"] = None
            if status_value == OutreachConsent.Statuses.OPTED_OUT:
                defaults["opted_out_at"] = now
            OutreachConsent.objects.update_or_create(
                business=business,
                client=client,
                channel=channel,
                defaults=defaults,
            )
            imported += 1
        return {"imported": imported, "skipped": skipped, "total_rows": len(rows)}

    def _resolve_business_for_import(self, business_id):
        businesses = accessible_businesses(self.request.user)
        if business_id:
            business = businesses.filter(id=business_id).first()
            if business is None:
                raise ValidationError({"business": "Business was not found."})
            return business
        business = businesses.order_by("id").first()
        if business is None:
            raise ValidationError({"business": "Business is required."})
        return business

    def _find_client(self, business, row):
        client_id = row.get("client") or row.get("client_id")
        if client_id:
            return Client.objects.filter(business=business, id=client_id, is_archived=False).first()
        phone = str(row.get("phone") or "").strip()
        email = str(row.get("email") or "").strip()
        if phone:
            client = Client.objects.filter(business=business, phone=phone, is_archived=False).first()
            if client:
                return client
        if email:
            return Client.objects.filter(business=business, email=email, is_archived=False).first()
        return None


def _assert_outreach_role(user, business, allowed_roles):
    if business is None:
        raise ValidationError({"business": "Business is required."})
    if business.owner_id == getattr(user, "id", None) and BusinessMember.Roles.OWNER in allowed_roles:
        return
    membership = BusinessMember.objects.filter(business=business, user=user, is_active=True).first()
    if membership and membership.role in allowed_roles:
        return
    raise PermissionDenied("Only owner, admin or marketer can manage outreach campaigns.")


def _resolve_accessible_business(request):
    businesses = accessible_businesses(request.user)
    business_id = request.query_params.get("business")
    if business_id:
        business = businesses.filter(id=business_id).first()
        if business is None:
            raise ValidationError({"business": "Business was not found."})
        return business
    business = businesses.order_by("id").first()
    if business is None:
        raise ValidationError({"business": "Business is required."})
    return business
