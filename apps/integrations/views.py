from datetime import timedelta

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.viewsets import ReadOnlyModelViewSet
from rest_framework.views import APIView
from django.conf import settings
from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from apps.core.security_config import has_strong_shared_secret

from apps.businesses.access import Actions, Resources, assert_can, can
from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.core.permissions import accessible_businesses, platform_admin_has_global_access
from apps.core.viewsets import TenantModelViewSet
from apps.integrations.connectors import update_connector_health
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
    API_TOKEN_DEFAULT_LIFETIME_DAYS,
    ApiTokenSerializer,
    BusinessConnectorSerializer,
    BusinessEventSerializer,
    ConnectorCapabilitySerializer,
    ConnectorCredentialSerializer,
    ConnectorSyncRunSerializer,
    InstagramOAuthCompleteSerializer,
    InstagramOAuthStartSerializer,
    IntegrationEventLogSerializer,
    KaspiConnectorConfigSerializer,
    MoySkladConnectorConfigSerializer,
    OzonConnectorConfigSerializer,
    WhatsAppConnectionRequestSerializer,
    WhatsAppEmbeddedSignupCompleteSerializer,
    WhatsAppEmbeddedSignupStartSerializer,
    WildberriesConnectorConfigSerializer,
    WebhookDeliveryLogSerializer,
    WebhookEndpointSerializer,
)
from apps.integrations.services import (
    complete_instagram_connection,
    complete_whatsapp_embedded_signup,
    connect_business_connector,
    connector_healthcheck,
    connector_status_payload,
    disconnect_business_connector,
    ingest_connector_business_event,
    mock_sync_connector,
    save_provider_connector_config,
    save_whatsapp_connection_request,
    start_instagram_oauth,
    start_whatsapp_embedded_signup,
    sync_connector,
    test_connector_connection,
)
from apps.integrations.sync_service import retry_connector_sync_run
from apps.integrations.telegram import save_telegram_inbound_message, verify_telegram_secret
from apps.integrations.webhooks import deliver_webhook_event
from apps.integrations.instagram import save_instagram_inbound_message, verify_instagram_secret
from apps.integrations.whatsapp import process_whatsapp_statuses, save_whatsapp_inbound_message, verify_whatsapp_secret


class IntegrationEventLogViewSet(ReadOnlyModelViewSet):
    serializer_class = IntegrationEventLogSerializer

    def get_queryset(self):
        queryset = IntegrationEventLog.objects.select_related("business")
        user = self.request.user
        if platform_admin_has_global_access(user):
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

    @action(detail=False, methods=["post"], url_path="kaspi-config")
    def kaspi_config(self, request):
        serializer = KaspiConnectorConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        connector, created = save_provider_connector_config(
            business=business,
            provider=BusinessConnector.Providers.KASPI,
            validated_data=serializer.validated_data,
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(connector).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="moysklad-config")
    def moysklad_config(self, request):
        serializer = MoySkladConnectorConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        connector, created = save_provider_connector_config(
            business=business,
            provider=BusinessConnector.Providers.MOYSKLAD,
            validated_data=serializer.validated_data,
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(connector).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="wildberries-config")
    def wildberries_config(self, request):
        serializer = WildberriesConnectorConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        connector, created = save_provider_connector_config(
            business=business,
            provider=BusinessConnector.Providers.WILDBERRIES,
            validated_data=serializer.validated_data,
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(connector).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="ozon-config")
    def ozon_config(self, request):
        serializer = OzonConnectorConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        connector, created = save_provider_connector_config(
            business=business,
            provider=BusinessConnector.Providers.OZON,
            validated_data=serializer.validated_data,
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(connector).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="whatsapp-request")
    def whatsapp_request(self, request):
        serializer = WhatsAppConnectionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        config = serializer.build_config()
        connector, created = save_whatsapp_connection_request(
            business=business,
            user=request.user,
            config=config,
            request=request,
        )
        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(self.get_serializer(connector).data, status=response_status)

    @action(detail=False, methods=["post"], url_path="whatsapp-embedded-signup/start")
    def whatsapp_embedded_signup_start(self, request):
        serializer = WhatsAppEmbeddedSignupStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        redirect_uri = serializer.validated_data.get("redirect_uri") or request.build_absolute_uri("/app/integrations")
        return Response(start_whatsapp_embedded_signup(business=business, user=request.user, redirect_uri=redirect_uri))

    @action(detail=False, methods=["post"], url_path="whatsapp-embedded-signup/complete")
    def whatsapp_embedded_signup_complete(self, request):
        serializer = WhatsAppEmbeddedSignupCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        redirect_uri = serializer.validated_data.get("redirect_uri") or request.build_absolute_uri("/app/integrations")
        try:
            channel, connector = complete_whatsapp_embedded_signup(
                business=business,
                user=request.user,
                code=serializer.validated_data["code"],
                state=serializer.validated_data["state"],
                redirect_uri=redirect_uri,
                phone_number_id=serializer.validated_data["phone_number_id"],
                waba_id=serializer.validated_data.get("waba_id", ""),
                display_phone_number=serializer.validated_data.get("display_phone_number", ""),
                request=request,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "ok": True,
                "channel_id": channel.id,
                "connector": self.get_serializer(connector).data,
            }
        )

    @action(detail=False, methods=["post"], url_path="instagram-oauth/start")
    def instagram_oauth_start(self, request):
        serializer = InstagramOAuthStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        redirect_uri = serializer.validated_data.get("redirect_uri") or request.build_absolute_uri("/app/integrations")
        return Response(start_instagram_oauth(business=business, user=request.user, redirect_uri=redirect_uri))

    @action(detail=False, methods=["post"], url_path="instagram-oauth/complete")
    def instagram_oauth_complete(self, request):
        serializer = InstagramOAuthCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        redirect_uri = serializer.validated_data.get("redirect_uri") or request.build_absolute_uri("/app/integrations")
        try:
            channel, connector = complete_instagram_connection(
                business=business,
                user=request.user,
                code=serializer.validated_data["code"],
                state=serializer.validated_data["state"],
                redirect_uri=redirect_uri,
                page_id=serializer.validated_data.get("page_id", ""),
                request=request,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"ok": True, "channel_id": channel.id, "connector": self.get_serializer(connector).data})

    @action(detail=True, methods=["post"])
    def connect(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        connector = connect_business_connector(connector=connector, request=request)
        return Response(self.get_serializer(connector).data)

    @action(detail=True, methods=["post"])
    def disconnect(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        connector = disconnect_business_connector(connector=connector, request=request)
        return Response(self.get_serializer(connector).data)

    @action(detail=True, methods=["post"], url_path="health-check")
    def health_check(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        run = connector_healthcheck(connector)
        return Response(ConnectorSyncRunSerializer(run).data)

    @action(detail=True, methods=["get"], url_path="kaspi-status")
    def kaspi_status(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.VIEW, obj=connector)
        return Response(connector_status_payload(connector, BusinessConnector.Providers.KASPI))

    @action(detail=True, methods=["get"], url_path="moysklad-status")
    def moysklad_status(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.VIEW, obj=connector)
        return Response(connector_status_payload(connector, BusinessConnector.Providers.MOYSKLAD))

    @action(detail=True, methods=["get"], url_path="wildberries-status")
    def wildberries_status(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.VIEW, obj=connector)
        return Response(connector_status_payload(connector, BusinessConnector.Providers.WILDBERRIES))

    @action(detail=True, methods=["get"], url_path="ozon-status")
    def ozon_status(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.VIEW, obj=connector)
        return Response(connector_status_payload(connector, BusinessConnector.Providers.OZON))

    @action(detail=True, methods=["post"], url_path="kaspi-test-connection")
    def kaspi_test_connection(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        return Response(test_connector_connection(connector, BusinessConnector.Providers.KASPI))

    @action(detail=True, methods=["post"], url_path="moysklad-test-connection")
    def moysklad_test_connection(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        return Response(test_connector_connection(connector, BusinessConnector.Providers.MOYSKLAD))

    @action(detail=True, methods=["post"], url_path="wildberries-test-connection")
    def wildberries_test_connection(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        return Response(test_connector_connection(connector, BusinessConnector.Providers.WILDBERRIES))

    @action(detail=True, methods=["post"], url_path="ozon-test-connection")
    def ozon_test_connection(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        return Response(test_connector_connection(connector, BusinessConnector.Providers.OZON))

    def _sync_response(self, result):
        response_status = status.HTTP_201_CREATED if result.get("ok") else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "events": BusinessEventSerializer(result["events"], many=True).data,
                "sync_run": ConnectorSyncRunSerializer(result["sync_run"]).data,
            },
            status=response_status,
        )

    @action(detail=True, methods=["post"], url_path="kaspi-sync-orders")
    def kaspi_sync_orders(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        return self._sync_response(sync_connector(connector, BusinessConnector.Providers.KASPI, request=request))

    @action(detail=True, methods=["post"], url_path="moysklad-sync")
    def moysklad_sync(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        return self._sync_response(sync_connector(connector, BusinessConnector.Providers.MOYSKLAD, request=request))

    @action(detail=True, methods=["post"], url_path="wildberries-sync")
    def wildberries_sync(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        return self._sync_response(sync_connector(connector, BusinessConnector.Providers.WILDBERRIES, request=request))

    @action(detail=True, methods=["post"], url_path="ozon-sync")
    def ozon_sync(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        return self._sync_response(sync_connector(connector, BusinessConnector.Providers.OZON, request=request))

    @action(detail=True, methods=["post"], url_path="events")
    def ingest_event(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        event, created = ingest_connector_business_event(connector=connector, data=request.data)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(BusinessEventSerializer(event).data, status=status_code)

    @action(detail=True, methods=["post"], url_path="mock-sync")
    def mock_sync(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        events = mock_sync_connector(connector, request=request)
        return Response(BusinessEventSerializer(events, many=True).data, status=status.HTTP_201_CREATED)


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
        if platform_admin_has_global_access(user):
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
        if platform_admin_has_global_access(user):
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

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        run = self.get_object()
        assert_can(request.user, run.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=run.connector)
        result = retry_connector_sync_run(run)
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            run.connector,
            business=run.business,
            metadata={
                "kind": "connector_sync_retry",
                "retry_kind": result["audit_kind"],
                "original_run_id": run.id,
                "new_run_id": result["sync_run"].id,
                "events": len(result["events"]),
            },
        )
        response_status = status.HTTP_201_CREATED if result.get("ok") else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "events": BusinessEventSerializer(result["events"], many=True).data,
                "sync_run": ConnectorSyncRunSerializer(result["sync_run"]).data,
            },
            status=response_status,
        )


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
        token.expires_at = timezone.now() + timedelta(days=API_TOKEN_DEFAULT_LIFETIME_DAYS)
        token.save(update_fields=["token_prefix", "token_hash", "is_active", "expires_at", "updated_at"])
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
        if platform_admin_has_global_access(user):
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

    def get(self, request):
        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token")
        challenge = request.query_params.get("hub.challenge")
        if settings.WHATSAPP_ENABLED and not has_strong_shared_secret(settings.WHATSAPP_VERIFY_TOKEN):
            return Response({"detail": "WhatsApp verify token is not production-ready."}, status=status.HTTP_403_FORBIDDEN)
        if mode == "subscribe" and token and token == settings.WHATSAPP_VERIFY_TOKEN and challenge:
            return HttpResponse(challenge, status=200, content_type="text/plain")
        return Response({"detail": "Invalid WhatsApp verification token."}, status=status.HTTP_403_FORBIDDEN)

    def post(self, request):
        provided_secret = verify_whatsapp_secret(request)
        status_result = process_whatsapp_statuses(request.data, provided_secret=provided_secret)
        if status_result is not None:
            return Response({"ok": True, **status_result}, status=200)
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


class InstagramWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "integration_webhook"

    def get(self, request):
        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token")
        challenge = request.query_params.get("hub.challenge")
        if mode == "subscribe" and token and token == settings.INSTAGRAM_VERIFY_TOKEN and challenge:
            return HttpResponse(challenge, status=200, content_type="text/plain")
        return Response({"detail": "Invalid Instagram verification token."}, status=status.HTTP_403_FORBIDDEN)

    def post(self, request):
        verify_instagram_secret(request)
        conversation, message = save_instagram_inbound_message(
            request.data,
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
