from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.core.viewsets import TenantModelViewSet


class ClientViewSet(TenantModelViewSet):
    queryset = Client.objects.select_related("business")
    serializer_class = ClientSerializer
