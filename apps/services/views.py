from apps.core.viewsets import TenantModelViewSet
from apps.services.models import Service
from apps.services.serializers import ServiceSerializer


class ServiceViewSet(TenantModelViewSet):
    queryset = Service.objects.select_related("business")
    serializer_class = ServiceSerializer
