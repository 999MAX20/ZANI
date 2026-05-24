from apps.businesses.access import Actions, Resources
from apps.core.viewsets import TenantModelViewSet
from apps.services.models import Service
from apps.services.serializers import ServiceSerializer


class ServiceViewSet(TenantModelViewSet):
    queryset = Service.objects.select_related("business")
    serializer_class = ServiceSerializer

    def get_access_resource(self):
        if self.action in {"list", "retrieve"}:
            return Resources.APPOINTMENTS
        return Resources.SETTINGS

    def get_access_action(self):
        if self.action in {"list", "retrieve"}:
            return Actions.VIEW
        return Actions.UPDATE
