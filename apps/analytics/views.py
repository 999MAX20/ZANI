from apps.analytics.models import AnalyticsEvent
from apps.analytics.serializers import AnalyticsEventSerializer
from apps.core.viewsets import TenantModelViewSet


class AnalyticsEventViewSet(TenantModelViewSet):
    queryset = AnalyticsEvent.objects.select_related("business", "client")
    serializer_class = AnalyticsEventSerializer
