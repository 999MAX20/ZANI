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
from apps.integrations.connectors import create_or_update_credential, normalize_business_event, run_connector_healthcheck, update_connector_health
from apps.integrations.kaspi import build_kaspi_mock_events, kaspi_connector_safe_config, sync_kaspi_orders, validate_kaspi_credentials
from apps.integrations.moysklad import build_moysklad_mock_events, moysklad_connector_safe_config, sync_moysklad, validate_moysklad_credentials
from apps.integrations.ozon import build_ozon_mock_events, ozon_connector_safe_config, sync_ozon, validate_ozon_credentials
from apps.integrations.wildberries import build_wildberries_mock_events, sync_wildberries, validate_wildberries_credentials, wildberries_connector_safe_config
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
from apps.integrations.one_c import build_one_c_mock_events
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
from apps.integrations.telegram import save_telegram_inbound_message, verify_telegram_secret
from apps.integrations.webhooks import deliver_webhook_event
from apps.integrations.instagram import save_instagram_inbound_message, verify_instagram_secret
from apps.integrations.instagram_oauth import build_instagram_oauth_url, complete_instagram_oauth
from apps.integrations.whatsapp import process_whatsapp_statuses, save_whatsapp_inbound_message, verify_whatsapp_secret
from apps.integrations.whatsapp.embedded_signup import build_embedded_signup_url, complete_embedded_signup


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
        connector, created = BusinessConnector.objects.get_or_create(
            business=business,
            provider=BusinessConnector.Providers.KASPI,
            name="Kaspi",
            defaults={
                "capability": BusinessConnector.Capabilities.FINANCE,
                "auth_type": BusinessConnector.AuthTypes.TOKEN,
                "status": BusinessConnector.Statuses.NEEDS_ATTENTION,
                "created_by": request.user,
            },
        )
        config = dict(connector.config_json or {})
        config.update(
            {
                "merchant_id": serializer.validated_data.get("merchant_id", config.get("merchant_id", "")),
                "order_state": serializer.validated_data.get("order_state", config.get("order_state", "ARCHIVE")),
                "sync_days": serializer.validated_data.get("sync_days", config.get("sync_days", 14)),
                "page_size": serializer.validated_data.get("page_size", config.get("page_size", 20)),
                "read_only": True,
                "api_token_configured": connector.credentials.filter(key="api_token").exists(),
                "last_operation": "config",
            }
        )
        api_token = serializer.validated_data.get("api_token", "")
        if api_token:
            create_or_update_credential(connector, "api_token", api_token)
            config["api_token_configured"] = True
        connector.capability = BusinessConnector.Capabilities.FINANCE
        connector.auth_type = BusinessConnector.AuthTypes.TOKEN
        connector.status = BusinessConnector.Statuses.CONNECTED if config["api_token_configured"] else BusinessConnector.Statuses.NEEDS_ATTENTION
        connector.config_json = config
        connector.last_error = ""
        if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
            connector.connected_at = timezone.now()
        connector.save(update_fields=["capability", "auth_type", "status", "config_json", "last_error", "connected_at", "updated_at"])
        write_audit_log(
            request,
            AuditLog.Actions.CREATE if created else AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": "kaspi_config_saved", "api_token_configured": config["api_token_configured"]},
        )
        return Response(self.get_serializer(connector).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="moysklad-config")
    def moysklad_config(self, request):
        serializer = MoySkladConnectorConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        connector, created = BusinessConnector.objects.get_or_create(
            business=business,
            provider=BusinessConnector.Providers.MOYSKLAD,
            name="МойСклад",
            defaults={
                "capability": BusinessConnector.Capabilities.INVENTORY,
                "auth_type": BusinessConnector.AuthTypes.TOKEN,
                "status": BusinessConnector.Statuses.NEEDS_ATTENTION,
                "created_by": request.user,
            },
        )
        config = dict(connector.config_json or {})
        config.update(
            {
                "entities": serializer.validated_data.get("entities", config.get("entities", ["products", "stock", "sales", "clients"])),
                "page_size": serializer.validated_data.get("page_size", config.get("page_size", 50)),
                "read_only": True,
                "access_token_configured": connector.credentials.filter(key="access_token").exists(),
                "auth_mode": "access_token",
                "future_auth_mode": "moysklad_marketplace_app",
                "last_operation": "config",
            }
        )
        access_token = serializer.validated_data.get("access_token", "")
        if access_token:
            create_or_update_credential(connector, "access_token", access_token)
            config["access_token_configured"] = True
        connector.capability = BusinessConnector.Capabilities.INVENTORY
        connector.auth_type = BusinessConnector.AuthTypes.TOKEN
        connector.status = BusinessConnector.Statuses.CONNECTED if config["access_token_configured"] else BusinessConnector.Statuses.NEEDS_ATTENTION
        connector.config_json = config
        connector.last_error = ""
        if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
            connector.connected_at = timezone.now()
        connector.save(update_fields=["capability", "auth_type", "status", "config_json", "last_error", "connected_at", "updated_at"])
        write_audit_log(
            request,
            AuditLog.Actions.CREATE if created else AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": "moysklad_config_saved", "access_token_configured": config["access_token_configured"]},
        )
        return Response(self.get_serializer(connector).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="wildberries-config")
    def wildberries_config(self, request):
        serializer = WildberriesConnectorConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        connector, created = BusinessConnector.objects.get_or_create(
            business=business,
            provider=BusinessConnector.Providers.WILDBERRIES,
            name="Wildberries",
            defaults={
                "capability": BusinessConnector.Capabilities.FINANCE,
                "auth_type": BusinessConnector.AuthTypes.TOKEN,
                "status": BusinessConnector.Statuses.NEEDS_ATTENTION,
                "created_by": request.user,
            },
        )
        config = dict(connector.config_json or {})
        config.update(
            {
                "entities": serializer.validated_data.get("entities", config.get("entities", ["orders", "sales"])),
                "sync_days": serializer.validated_data.get("sync_days", config.get("sync_days", 7)),
                "read_only": True,
                "api_token_configured": connector.credentials.filter(key="api_token").exists(),
                "auth_mode": "statistics_token",
                "last_operation": "config",
            }
        )
        api_token = serializer.validated_data.get("api_token", "")
        if api_token:
            create_or_update_credential(connector, "api_token", api_token)
            config["api_token_configured"] = True
        connector.capability = BusinessConnector.Capabilities.FINANCE
        connector.auth_type = BusinessConnector.AuthTypes.TOKEN
        connector.status = BusinessConnector.Statuses.CONNECTED if config["api_token_configured"] else BusinessConnector.Statuses.NEEDS_ATTENTION
        connector.config_json = config
        connector.last_error = ""
        if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
            connector.connected_at = timezone.now()
        connector.save(update_fields=["capability", "auth_type", "status", "config_json", "last_error", "connected_at", "updated_at"])
        write_audit_log(
            request,
            AuditLog.Actions.CREATE if created else AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": "wildberries_config_saved", "api_token_configured": config["api_token_configured"]},
        )
        return Response(self.get_serializer(connector).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="ozon-config")
    def ozon_config(self, request):
        serializer = OzonConnectorConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        connector, created = BusinessConnector.objects.get_or_create(
            business=business,
            provider=BusinessConnector.Providers.OZON,
            name="Ozon",
            defaults={
                "capability": BusinessConnector.Capabilities.FINANCE,
                "auth_type": BusinessConnector.AuthTypes.TOKEN,
                "status": BusinessConnector.Statuses.NEEDS_ATTENTION,
                "created_by": request.user,
            },
        )
        config = dict(connector.config_json or {})
        config.update(
            {
                "entities": serializer.validated_data.get("entities", config.get("entities", ["fbs_postings", "fbo_postings", "stocks"])),
                "sync_days": serializer.validated_data.get("sync_days", config.get("sync_days", 7)),
                "limit": serializer.validated_data.get("limit", config.get("limit", 50)),
                "read_only": True,
                "client_id_configured": connector.credentials.filter(key="client_id").exists(),
                "api_key_configured": connector.credentials.filter(key="api_key").exists(),
                "auth_mode": "client_id_api_key",
                "last_operation": "config",
            }
        )
        client_id = serializer.validated_data.get("client_id", "")
        api_key = serializer.validated_data.get("api_key", "")
        if client_id:
            create_or_update_credential(connector, "client_id", client_id)
            config["client_id_configured"] = True
        if api_key:
            create_or_update_credential(connector, "api_key", api_key)
            config["api_key_configured"] = True
        connector.capability = BusinessConnector.Capabilities.FINANCE
        connector.auth_type = BusinessConnector.AuthTypes.TOKEN
        connector.status = BusinessConnector.Statuses.CONNECTED if config["client_id_configured"] and config["api_key_configured"] else BusinessConnector.Statuses.NEEDS_ATTENTION
        connector.config_json = config
        connector.last_error = ""
        if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
            connector.connected_at = timezone.now()
        connector.save(update_fields=["capability", "auth_type", "status", "config_json", "last_error", "connected_at", "updated_at"])
        write_audit_log(
            request,
            AuditLog.Actions.CREATE if created else AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": "ozon_config_saved", "client_id_configured": config["client_id_configured"], "api_key_configured": config["api_key_configured"]},
        )
        return Response(self.get_serializer(connector).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="whatsapp-request")
    def whatsapp_request(self, request):
        serializer = WhatsAppConnectionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        config = serializer.build_config()
        decision = config["provider_decision"]
        connector, created = BusinessConnector.objects.update_or_create(
            business=business,
            provider=BusinessConnector.Providers.WHATSAPP,
            name="WhatsApp connection request",
            defaults={
                "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
                "auth_type": BusinessConnector.AuthTypes.QR,
                "status": decision["status"],
                "config_json": config,
                "scopes_json": [],
                "last_error": "",
                "created_by": request.user,
            },
        )
        write_audit_log(
            request,
            AuditLog.Actions.CREATE if created else AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": "whatsapp_connection_request_saved", "provider_decision": decision["provider_key"]},
        )
        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(self.get_serializer(connector).data, status=response_status)

    @action(detail=False, methods=["post"], url_path="whatsapp-embedded-signup/start")
    def whatsapp_embedded_signup_start(self, request):
        serializer = WhatsAppEmbeddedSignupStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        redirect_uri = serializer.validated_data.get("redirect_uri") or request.build_absolute_uri("/dashboard/integrations")
        authorization_url, state = build_embedded_signup_url(business=business, user=request.user, redirect_uri=redirect_uri)
        return Response(
            {
                "authorization_url": authorization_url,
                "state": state,
                "redirect_uri": redirect_uri,
                "app_configured": bool(settings.META_APP_ID and settings.META_APP_SECRET),
                "config_id_configured": bool(settings.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID),
                "app_id": settings.META_APP_ID,
                "config_id": settings.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID,
                "graph_api_version": settings.WHATSAPP_GRAPH_API_VERSION,
            }
        )

    @action(detail=False, methods=["post"], url_path="whatsapp-embedded-signup/complete")
    def whatsapp_embedded_signup_complete(self, request):
        serializer = WhatsAppEmbeddedSignupCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        redirect_uri = serializer.validated_data.get("redirect_uri") or request.build_absolute_uri("/dashboard/integrations")
        try:
            channel, connector = complete_embedded_signup(
                business=business,
                user=request.user,
                code=serializer.validated_data["code"],
                state=serializer.validated_data["state"],
                redirect_uri=redirect_uri,
                phone_number_id=serializer.validated_data["phone_number_id"],
                waba_id=serializer.validated_data.get("waba_id", ""),
                display_phone_number=serializer.validated_data.get("display_phone_number", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": "whatsapp_embedded_signup_completed", "bot_channel_id": channel.id},
        )
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
        redirect_uri = serializer.validated_data.get("redirect_uri") or request.build_absolute_uri("/dashboard/integrations")
        authorization_url, state = build_instagram_oauth_url(business=business, user=request.user, redirect_uri=redirect_uri)
        return Response(
            {
                "authorization_url": authorization_url,
                "state": state,
                "redirect_uri": redirect_uri,
                "app_configured": bool(settings.META_APP_ID and settings.META_APP_SECRET),
                "app_id": settings.META_APP_ID,
                "graph_api_version": settings.INSTAGRAM_GRAPH_API_VERSION,
            }
        )

    @action(detail=False, methods=["post"], url_path="instagram-oauth/complete")
    def instagram_oauth_complete(self, request):
        serializer = InstagramOAuthCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        redirect_uri = serializer.validated_data.get("redirect_uri") or request.build_absolute_uri("/dashboard/integrations")
        try:
            channel, connector = complete_instagram_oauth(
                business=business,
                user=request.user,
                code=serializer.validated_data["code"],
                state=serializer.validated_data["state"],
                redirect_uri=redirect_uri,
                page_id=serializer.validated_data.get("page_id", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            connector,
            business=business,
            metadata={"kind": "instagram_oauth_completed", "bot_channel_id": channel.id},
        )
        return Response({"ok": True, "channel_id": channel.id, "connector": self.get_serializer(connector).data})

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

    @action(detail=True, methods=["get"], url_path="kaspi-status")
    def kaspi_status(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.VIEW, obj=connector)
        if connector.provider != BusinessConnector.Providers.KASPI:
            return Response({"detail": "This action is only available for Kaspi connectors."}, status=status.HTTP_400_BAD_REQUEST)
        config = kaspi_connector_safe_config(connector)
        return Response(
            {
                "status": connector.status,
                "api_token_configured": connector.credentials.filter(key="api_token").exists(),
                "kaspi_enabled": settings.KASPI_ENABLED,
                "api_base_url": settings.KASPI_API_BASE_URL,
                "last_error": connector.last_error,
                "last_sync_at": connector.last_sync_at,
                "next_sync_at": connector.next_sync_at,
                **config,
            }
        )

    @action(detail=True, methods=["get"], url_path="moysklad-status")
    def moysklad_status(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.VIEW, obj=connector)
        if connector.provider != BusinessConnector.Providers.MOYSKLAD:
            return Response({"detail": "This action is only available for MoySklad connectors."}, status=status.HTTP_400_BAD_REQUEST)
        config = moysklad_connector_safe_config(connector)
        return Response(
            {
                "status": connector.status,
                "access_token_configured": connector.credentials.filter(key="access_token").exists(),
                "moysklad_enabled": settings.MOYSKLAD_ENABLED,
                "api_base_url": settings.MOYSKLAD_API_BASE_URL,
                "last_error": connector.last_error,
                "last_sync_at": connector.last_sync_at,
                "next_sync_at": connector.next_sync_at,
                **config,
            }
        )

    @action(detail=True, methods=["get"], url_path="wildberries-status")
    def wildberries_status(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.VIEW, obj=connector)
        if connector.provider != BusinessConnector.Providers.WILDBERRIES:
            return Response({"detail": "This action is only available for Wildberries connectors."}, status=status.HTTP_400_BAD_REQUEST)
        config = wildberries_connector_safe_config(connector)
        return Response(
            {
                "status": connector.status,
                "api_token_configured": connector.credentials.filter(key="api_token").exists(),
                "wildberries_enabled": settings.WILDBERRIES_ENABLED,
                "api_base_url": settings.WILDBERRIES_STATISTICS_API_BASE_URL,
                "last_error": connector.last_error,
                "last_sync_at": connector.last_sync_at,
                "next_sync_at": connector.next_sync_at,
                **config,
            }
        )

    @action(detail=True, methods=["get"], url_path="ozon-status")
    def ozon_status(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.VIEW, obj=connector)
        if connector.provider != BusinessConnector.Providers.OZON:
            return Response({"detail": "This action is only available for Ozon connectors."}, status=status.HTTP_400_BAD_REQUEST)
        config = ozon_connector_safe_config(connector)
        return Response(
            {
                "status": connector.status,
                "client_id_configured": connector.credentials.filter(key="client_id").exists(),
                "api_key_configured": connector.credentials.filter(key="api_key").exists(),
                "ozon_enabled": settings.OZON_ENABLED,
                "api_base_url": settings.OZON_SELLER_API_BASE_URL,
                "last_error": connector.last_error,
                "last_sync_at": connector.last_sync_at,
                "next_sync_at": connector.next_sync_at,
                **config,
            }
        )

    @action(detail=True, methods=["post"], url_path="kaspi-test-connection")
    def kaspi_test_connection(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        if connector.provider != BusinessConnector.Providers.KASPI:
            return Response({"detail": "This action is only available for Kaspi connectors."}, status=status.HTTP_400_BAD_REQUEST)
        result = validate_kaspi_credentials(connector)
        connector.status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        connector.last_error = "" if result.get("ok") else result.get("reason", "Kaspi credentials validation failed.")
        if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
            connector.connected_at = timezone.now()
        connector.save(update_fields=["status", "last_error", "connected_at", "updated_at"])
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "status": connector.status,
                "orders_count": result.get("orders_count", 0),
                "api_token_configured": connector.credentials.filter(key="api_token").exists(),
            }
        )

    @action(detail=True, methods=["post"], url_path="moysklad-test-connection")
    def moysklad_test_connection(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        if connector.provider != BusinessConnector.Providers.MOYSKLAD:
            return Response({"detail": "This action is only available for MoySklad connectors."}, status=status.HTTP_400_BAD_REQUEST)
        result = validate_moysklad_credentials(connector)
        connector.status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        connector.last_error = "" if result.get("ok") else result.get("reason", "MoySklad credentials validation failed.")
        if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
            connector.connected_at = timezone.now()
        connector.save(update_fields=["status", "last_error", "connected_at", "updated_at"])
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "status": connector.status,
                "rows_count": result.get("rows_count", 0),
                "access_token_configured": connector.credentials.filter(key="access_token").exists(),
            }
        )

    @action(detail=True, methods=["post"], url_path="wildberries-test-connection")
    def wildberries_test_connection(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        if connector.provider != BusinessConnector.Providers.WILDBERRIES:
            return Response({"detail": "This action is only available for Wildberries connectors."}, status=status.HTTP_400_BAD_REQUEST)
        result = validate_wildberries_credentials(connector)
        connector.status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        connector.last_error = "" if result.get("ok") else result.get("reason", "Wildberries credentials validation failed.")
        if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
            connector.connected_at = timezone.now()
        connector.save(update_fields=["status", "last_error", "connected_at", "updated_at"])
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "status": connector.status,
                "rows_count": result.get("rows_count", 0),
                "api_token_configured": connector.credentials.filter(key="api_token").exists(),
            }
        )

    @action(detail=True, methods=["post"], url_path="ozon-test-connection")
    def ozon_test_connection(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        if connector.provider != BusinessConnector.Providers.OZON:
            return Response({"detail": "This action is only available for Ozon connectors."}, status=status.HTTP_400_BAD_REQUEST)
        result = validate_ozon_credentials(connector)
        connector.status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        connector.last_error = "" if result.get("ok") else result.get("reason", "Ozon credentials validation failed.")
        if connector.status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
            connector.connected_at = timezone.now()
        connector.save(update_fields=["status", "last_error", "connected_at", "updated_at"])
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "status": connector.status,
                "warehouses_count": result.get("warehouses_count", 0),
                "client_id_configured": connector.credentials.filter(key="client_id").exists(),
                "api_key_configured": connector.credentials.filter(key="api_key").exists(),
            }
        )

    @action(detail=True, methods=["post"], url_path="kaspi-sync-orders")
    def kaspi_sync_orders(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        if connector.provider != BusinessConnector.Providers.KASPI:
            return Response({"detail": "This action is only available for Kaspi connectors."}, status=status.HTTP_400_BAD_REQUEST)
        result = sync_kaspi_orders(connector)
        events = []
        for item in result.get("events", []):
            event, _created = normalize_business_event(
                business=connector.business,
                connector=connector,
                source=connector.provider,
                event_type=item.event_type,
                external_id=item.external_id,
                payload=item.payload,
            )
            events.append(event)
        connector.status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        connector.last_error = "" if result.get("ok") else result.get("reason", "Kaspi sync failed.")
        connector.last_sync_at = result["run"].finished_at
        connector.next_sync_at = timezone.now() + timedelta(hours=6)
        connector.save(update_fields=["status", "last_error", "last_sync_at", "next_sync_at", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "kaspi_sync_orders", "events": len(events), "mock": result.get("mock", False)})
        response_status = status.HTTP_201_CREATED if result.get("ok") else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "events": BusinessEventSerializer(events, many=True).data,
                "sync_run": ConnectorSyncRunSerializer(result["run"]).data,
            },
            status=response_status,
        )

    @action(detail=True, methods=["post"], url_path="moysklad-sync")
    def moysklad_sync(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        if connector.provider != BusinessConnector.Providers.MOYSKLAD:
            return Response({"detail": "This action is only available for MoySklad connectors."}, status=status.HTTP_400_BAD_REQUEST)
        result = sync_moysklad(connector)
        events = []
        for item in result.get("events", []):
            event, _created = normalize_business_event(
                business=connector.business,
                connector=connector,
                source=connector.provider,
                event_type=item.event_type,
                external_id=item.external_id,
                payload=item.payload,
            )
            events.append(event)
        connector.status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        connector.last_error = "" if result.get("ok") else result.get("reason", "MoySklad sync failed.")
        connector.last_sync_at = result["run"].finished_at
        connector.next_sync_at = timezone.now() + timedelta(hours=6)
        connector.save(update_fields=["status", "last_error", "last_sync_at", "next_sync_at", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "moysklad_sync", "events": len(events), "mock": result.get("mock", False)})
        response_status = status.HTTP_201_CREATED if result.get("ok") else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "events": BusinessEventSerializer(events, many=True).data,
                "sync_run": ConnectorSyncRunSerializer(result["run"]).data,
            },
            status=response_status,
        )

    @action(detail=True, methods=["post"], url_path="wildberries-sync")
    def wildberries_sync(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        if connector.provider != BusinessConnector.Providers.WILDBERRIES:
            return Response({"detail": "This action is only available for Wildberries connectors."}, status=status.HTTP_400_BAD_REQUEST)
        result = sync_wildberries(connector)
        events = []
        for item in result.get("events", []):
            event, _created = normalize_business_event(
                business=connector.business,
                connector=connector,
                source=connector.provider,
                event_type=item.event_type,
                external_id=item.external_id,
                payload=item.payload,
            )
            events.append(event)
        connector.status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        connector.last_error = "" if result.get("ok") else result.get("reason", "Wildberries sync failed.")
        connector.last_sync_at = result["run"].finished_at
        connector.next_sync_at = timezone.now() + timedelta(minutes=30)
        connector.save(update_fields=["status", "last_error", "last_sync_at", "next_sync_at", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "wildberries_sync", "events": len(events), "mock": result.get("mock", False)})
        response_status = status.HTTP_201_CREATED if result.get("ok") else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "events": BusinessEventSerializer(events, many=True).data,
                "sync_run": ConnectorSyncRunSerializer(result["run"]).data,
            },
            status=response_status,
        )

    @action(detail=True, methods=["post"], url_path="ozon-sync")
    def ozon_sync(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        if connector.provider != BusinessConnector.Providers.OZON:
            return Response({"detail": "This action is only available for Ozon connectors."}, status=status.HTTP_400_BAD_REQUEST)
        result = sync_ozon(connector)
        events = []
        for item in result.get("events", []):
            event, _created = normalize_business_event(
                business=connector.business,
                connector=connector,
                source=connector.provider,
                event_type=item.event_type,
                external_id=item.external_id,
                payload=item.payload,
            )
            events.append(event)
        connector.status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        connector.last_error = "" if result.get("ok") else result.get("reason", "Ozon sync failed.")
        connector.last_sync_at = result["run"].finished_at
        connector.next_sync_at = timezone.now() + timedelta(minutes=30)
        connector.save(update_fields=["status", "last_error", "last_sync_at", "next_sync_at", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "ozon_sync", "events": len(events), "mock": result.get("mock", False)})
        response_status = status.HTTP_201_CREATED if result.get("ok") else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "events": BusinessEventSerializer(events, many=True).data,
                "sync_run": ConnectorSyncRunSerializer(result["run"]).data,
            },
            status=response_status,
        )

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

    @action(detail=True, methods=["post"], url_path="mock-sync")
    def mock_sync(self, request, pk=None):
        connector = self.get_object()
        assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
        mock_events = build_connector_mock_events(connector)
        if not mock_events:
            return Response({"detail": "Mock sync is available only for lightweight data connectors."}, status=status.HTTP_400_BAD_REQUEST)

        events = []
        for item in mock_events:
            payload = item.payload if hasattr(item, "payload") else item["payload"]
            event_type = item.event_type if hasattr(item, "event_type") else item["event_type"]
            external_id = item.external_id if hasattr(item, "external_id") else item["external_id"]
            event, _created = normalize_business_event(
                business=connector.business,
                connector=connector,
                source=connector.provider,
                event_type=event_type,
                external_id=external_id,
                payload=payload,
            )
            events.append(event)

        connector.last_sync_at = timezone.now()
        connector.save(update_fields=["last_sync_at", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, connector, business=connector.business, metadata={"kind": "connector_mock_sync", "events": len(events)})
        return Response(BusinessEventSerializer(events, many=True).data, status=status.HTTP_201_CREATED)


def build_connector_mock_events(connector):
    prefix = f"demo-{connector.provider}-{connector.id}"
    if connector.provider == BusinessConnector.Providers.KASPI:
        return build_kaspi_mock_events(prefix=prefix)
    if connector.provider == BusinessConnector.Providers.ONE_C:
        return build_one_c_mock_events(prefix=prefix)
    if connector.provider == BusinessConnector.Providers.MOYSKLAD:
        return build_moysklad_mock_events(prefix=prefix)
    if connector.provider == BusinessConnector.Providers.WILDBERRIES:
        return build_wildberries_mock_events(prefix=prefix)
    if connector.provider == BusinessConnector.Providers.OZON:
        return build_ozon_mock_events(prefix=prefix)
    return []


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
