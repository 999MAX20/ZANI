from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.viewsets import ReadOnlyModelViewSet
from rest_framework.views import APIView
from django.db.models import Count
from django.utils import timezone

from apps.businesses.access import Actions, Resources, assert_can, can
from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.core.permissions import accessible_businesses, is_platform_admin
from apps.core.viewsets import TenantModelViewSet
from apps.integrations.connectors import normalize_business_event, run_connector_healthcheck, update_connector_health
from apps.integrations.models import (
    ApiToken,
    BusinessConnector,
    BusinessEvent,
    ConnectorCredential,
    ConnectorSyncRun,
    IntegrationEventLog,
    WebhookDeliveryLog,
    WebhookEndpoint,
)
from apps.integrations.public_api import authenticate_api_token
from apps.integrations.serializers import (
    ApiTokenSerializer,
    BusinessConnectorSerializer,
    BusinessEventSerializer,
    ConnectorCapabilitySerializer,
    ConnectorCredentialSerializer,
    ConnectorSyncRunSerializer,
    IntegrationEventLogSerializer,
    WebhookDeliveryLogSerializer,
    WebhookEndpointSerializer,
)
from apps.integrations.telegram import save_telegram_inbound_message, verify_telegram_secret
from apps.integrations.webhooks import deliver_webhook_event
from apps.integrations.whatsapp import save_whatsapp_inbound_message, verify_whatsapp_secret


class IntegrationEventLogViewSet(ReadOnlyModelViewSet):
    serializer_class = IntegrationEventLogSerializer

    def get_queryset(self):
        queryset = IntegrationEventLog.objects.select_related("business")
        user = self.request.user
        if is_platform_admin(user):
            return queryset

        scoped = queryset.none()
        for business in accessible_businesses(user):
            if can(user, business, Resources.INTEGRATIONS, Actions.VIEW).allowed:
                scoped = scoped | queryset.filter(business=business)
        provider = self.request.query_params.get("provider")
        channel = self.request.query_params.get("channel")
        status = self.request.query_params.get("status")
        direction = self.request.query_params.get("direction")
        if provider:
            scoped = scoped.filter(provider=provider)
        if channel:
            scoped = scoped.filter(channel=channel)
        if status:
            scoped = scoped.filter(status=status)
        if direction:
            scoped = scoped.filter(direction=direction)
        return scoped.distinct()


class BusinessConnectorViewSet(TenantModelViewSet):
    queryset = BusinessConnector.objects.select_related("business", "created_by").annotate(credentials_count=Count("credentials", distinct=True))
    serializer_class = BusinessConnectorSerializer
    access_resource = Resources.INTEGRATIONS

    def get_queryset(self):
        return super().get_queryset().order_by("provider", "name", "id")

    def perform_create(self, serializer):
        self._enforce_business_access(serializer)
        connector = serializer.save(created_by=self.request.user)
        update_connector_health(connector)
        write_audit_log(self.request, AuditLog.Actions.CREATE, connector, business=connector.business, metadata={"kind": "business_connector_created"})

    def perform_update(self, serializer):
        self._enforce_business_access(serializer)
        connector = serializer.save()
        update_connector_health(connector)
        write_audit_log(self.request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "business_connector_updated"})

    @action(detail=False, methods=["get"])
    def capabilities(self, request):
        return Response(ConnectorCapabilitySerializer.data_list())

    @action(detail=True, methods=["post"])
    def connect(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        connector.status = BusinessConnector.Statuses.CONNECTED
        connector.last_error = ""
        connector.connected_at = connector.connected_at or timezone.now()
        connector.save(update_fields=["status", "last_error", "connected_at", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "business_connector_connected"})
        return Response(self.get_serializer(connector).data)

    @action(detail=True, methods=["post"])
    def disconnect(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        connector.status = BusinessConnector.Statuses.DISABLED
        connector.save(update_fields=["status", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "business_connector_disconnected"})
        return Response(self.get_serializer(connector).data)

    @action(detail=True, methods=["post"], url_path="health-check")
    def health_check(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        run = run_connector_healthcheck(connector)
        return Response(ConnectorSyncRunSerializer(run).data)

    @action(detail=True, methods=["post"], url_path="events")
    def ingest_event(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        event, created = normalize_business_event(
            business=connector.business,
            connector=connector,
            source=connector.provider,
            event_type=request.data.get("event_type", "integration.event"),
            external_id=request.data.get("external_id", ""),
            payload=request.data.get("payload_json", request.data.get("payload", {})),
        )
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(BusinessEventSerializer(event).data, status=status_code)


class ConnectorCredentialViewSet(TenantModelViewSet):
    queryset = ConnectorCredential.objects.select_related("business", "connector")
    serializer_class = ConnectorCredentialSerializer
    access_resource = Resources.INTEGRATIONS

    def perform_create(self, serializer):
        self._enforce_business_access(serializer)
        credential = serializer.save()
        update_connector_health(credential.connector)
        write_audit_log(self.request, AuditLog.Actions.CREATE, credential.connector, business=credential.business, metadata={"kind": "connector_credential_saved", "key": credential.key})

    def perform_update(self, serializer):
        self._enforce_business_access(serializer)
        credential = serializer.save()
        update_connector_health(credential.connector)
        write_audit_log(self.request, AuditLog.Actions.UPDATE, credential.connector, business=credential.business, metadata={"kind": "connector_credential_rotated", "key": credential.key})


class BusinessEventViewSet(ReadOnlyModelViewSet):
    serializer_class = BusinessEventSerializer

    def get_queryset(self):
        queryset = BusinessEvent.objects.select_related("business", "connector")
        user = self.request.user
        if is_platform_admin(user):
            filtered = queryset
        else:
            filtered = queryset.none()
            for business in accessible_businesses(user):
                if can(user, business, Resources.INTEGRATIONS, Actions.VIEW).allowed:
                    filtered = filtered | queryset.filter(business=business)
        source = self.request.query_params.get("source")
        event_type = self.request.query_params.get("event_type")
        status_filter = self.request.query_params.get("status")
        if source:
            filtered = filtered.filter(source=source)
        if event_type:
            filtered = filtered.filter(event_type=event_type)
        if status_filter:
            filtered = filtered.filter(status=status_filter)
        return filtered.distinct()


class ConnectorSyncRunViewSet(ReadOnlyModelViewSet):
    serializer_class = ConnectorSyncRunSerializer

    def get_queryset(self):
        queryset = ConnectorSyncRun.objects.select_related("business", "connector")
        user = self.request.user
        if is_platform_admin(user):
            filtered = queryset
        else:
            filtered = queryset.none()
            for business in accessible_businesses(user):
                if can(user, business, Resources.INTEGRATIONS, Actions.VIEW).allowed:
                    filtered = filtered | queryset.filter(business=business)
        connector = self.request.query_params.get("connector")
        status_filter = self.request.query_params.get("status")
        if connector:
            filtered = filtered.filter(connector_id=connector)
        if status_filter:
            filtered = filtered.filter(status=status_filter)
        return filtered.distinct()


class ApiTokenViewSet(TenantModelViewSet):
    queryset = ApiToken.objects.select_related("business", "created_by")
    serializer_class = ApiTokenSerializer
    access_resource = Resources.INTEGRATIONS

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self._enforce_business_access(serializer)
        raw_token = ApiToken.generate_raw_token()
        token = serializer.save(created_by=request.user)
        token.set_raw_token(raw_token)
        token.save(update_fields=["token_prefix", "token_hash", "updated_at"])
        write_audit_log(request, AuditLog.Actions.CREATE, token, business=token.business, metadata={"kind": "api_token_created"})
        data = self.get_serializer(token).data
        data["token"] = raw_token
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def rotate(self, request, pk=None):
        token = self.get_object()
        assert_can(request.user, token.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=token)
        raw_token = ApiToken.generate_raw_token()
        token.set_raw_token(raw_token)
        token.is_active = True
        token.save(update_fields=["token_prefix", "token_hash", "is_active", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, token, business=token.business, metadata={"kind": "api_token_rotated"})
        data = self.get_serializer(token).data
        data["token"] = raw_token
        return Response(data)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        token = self.get_object()
        assert_can(request.user, token.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=token)
        token.is_active = False
        token.save(update_fields=["is_active", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, token, business=token.business, metadata={"kind": "api_token_revoked"})
        return Response(self.get_serializer(token).data)


class WebhookEndpointViewSet(TenantModelViewSet):
    queryset = WebhookEndpoint.objects.select_related("business", "created_by")
    serializer_class = WebhookEndpointSerializer
    access_resource = Resources.INTEGRATIONS

    def perform_create(self, serializer):
        self._enforce_business_access(serializer)
        endpoint = serializer.save(created_by=self.request.user)
        write_audit_log(self.request, AuditLog.Actions.CREATE, endpoint, business=endpoint.business, metadata={"kind": "webhook_endpoint_created"})

    @action(detail=True, methods=["post"], url_path="test-delivery")
    def test_delivery(self, request, pk=None):
        endpoint = self.get_object()
        assert_can(request.user, endpoint.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=endpoint)
        log = deliver_webhook_event(
            endpoint,
            "system.test",
            {"message": "Zani webhook test", "endpoint_id": endpoint.id},
            f"test-{endpoint.id}-{request.user.id}",
        )
        return Response(WebhookDeliveryLogSerializer(log).data)


class WebhookDeliveryLogViewSet(ReadOnlyModelViewSet):
    serializer_class = WebhookDeliveryLogSerializer

    def get_queryset(self):
        queryset = WebhookDeliveryLog.objects.select_related("business", "endpoint")
        user = self.request.user
        if is_platform_admin(user):
            filtered = queryset
        else:
            filtered = queryset.none()
            for business in accessible_businesses(user):
                if can(user, business, Resources.INTEGRATIONS, Actions.VIEW).allowed:
                    filtered = filtered | queryset.filter(business=business)
        endpoint = self.request.query_params.get("endpoint")
        status_filter = self.request.query_params.get("status")
        if endpoint:
            filtered = filtered.filter(endpoint_id=endpoint)
        if status_filter:
            filtered = filtered.filter(status=status_filter)
        return filtered.distinct()

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        log = self.get_object()
        if not can(request.user, log.business, Resources.INTEGRATIONS, Actions.MANAGE).allowed:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        retried = deliver_webhook_event(log.endpoint, log.event_type, log.payload_json, log.idempotency_key)
        return Response(self.get_serializer(retried).data)


class PublicApiClientsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_api"

    def get(self, request):
        try:
            token = authenticate_api_token(request, "clients:read")
        except AuthenticationFailed as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)
        clients = Client.objects.filter(business=token.business, is_archived=False)[:100]
        return Response(ClientSerializer(clients, many=True).data)


class TelegramWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "integration_webhook"

    def post(self, request):
        provided_secret = verify_telegram_secret(request)
        conversation, message = save_telegram_inbound_message(request.data, provided_secret)
        return Response(
            {
                "ok": True,
                "conversation_id": conversation.id,
                "message_id": message.id,
            },
            status=200,
        )


class WhatsAppWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "integration_webhook"

    def post(self, request):
        provided_secret = verify_whatsapp_secret(request)
        conversation, message = save_whatsapp_inbound_message(
            request.data,
            provided_secret,
            headers={key: value for key, value in request.META.items() if key.startswith("HTTP_")},
        )
        return Response(
            {
                "ok": True,
                "conversation_id": conversation.id,
                "message_id": message.id,
            },
            status=200,
        )
