from rest_framework import status
from rest_framework.response import Response

from apps.businesses.access import Actions, Resources, assert_can
from apps.integrations.models import BusinessConnector
from apps.integrations.serializers import (
    BusinessEventSerializer,
    ConnectorSyncRunSerializer,
    KaspiConnectorConfigSerializer,
    MoySkladConnectorConfigSerializer,
    OzonConnectorConfigSerializer,
    WildberriesConnectorConfigSerializer,
)
from apps.integrations.services import (
    connector_status_payload,
    save_provider_connector_config,
    sync_connector,
    test_connector_connection,
)


PROVIDER_CONFIG_SERIALIZERS = {
    BusinessConnector.Providers.KASPI: KaspiConnectorConfigSerializer,
    BusinessConnector.Providers.MOYSKLAD: MoySkladConnectorConfigSerializer,
    BusinessConnector.Providers.WILDBERRIES: WildberriesConnectorConfigSerializer,
    BusinessConnector.Providers.OZON: OzonConnectorConfigSerializer,
}


def save_provider_config_action(viewset, request, provider):
    serializer_class = PROVIDER_CONFIG_SERIALIZERS[provider]
    serializer = serializer_class(data=request.data)
    serializer.is_valid(raise_exception=True)
    business = serializer.validated_data["business"]
    assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
    connector, created = save_provider_connector_config(
        business=business,
        provider=provider,
        validated_data=serializer.validated_data,
        user=request.user,
        request=request,
    )
    response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response(viewset.get_serializer(connector).data, status=response_status)


def provider_status_action(viewset, request, provider):
    connector = viewset.get_object()
    assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.VIEW, obj=connector)
    return Response(connector_status_payload(connector, provider))


def provider_test_connection_action(viewset, request, provider):
    connector = viewset.get_object()
    assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
    return Response(test_connector_connection(connector, provider))


def provider_sync_action(viewset, request, provider):
    connector = viewset.get_object()
    assert_can(request.user, connector.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=connector)
    return sync_response(sync_connector(connector, provider, request=request))


def sync_response(result):
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
