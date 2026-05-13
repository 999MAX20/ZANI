from rest_framework.decorators import action
from rest_framework.response import Response

from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.core.crm_cards import client_crm_card
from apps.core.viewsets import TenantModelViewSet


class ClientViewSet(TenantModelViewSet):
    queryset = Client.objects.select_related("business")
    serializer_class = ClientSerializer

    @action(detail=True, methods=["get"], url_path="crm-card")
    def crm_card(self, request, pk=None):
        client = self.get_object()
        return Response(client_crm_card(client))
