from django.db.models import Q
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.businesses.access import Actions, Resources, assert_can, can
from apps.core.permissions import accessible_businesses
from apps.core.viewsets import TenantModelViewSet
from apps.services.models import Service
from apps.services.serializers import ServiceSerializer
from apps.services.services import archive_service, restore_service, set_service_active


class ServicePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100


class ServiceViewSet(TenantModelViewSet):
    queryset = Service.objects.select_related("business")
    serializer_class = ServiceSerializer
    pagination_class = ServicePagination

    def get_queryset(self):
        queryset = super().get_queryset()
        business_id = self.request.query_params.get("business")
        search = (self.request.query_params.get("search") or "").strip()
        status = self.request.query_params.get("status")

        if business_id:
            queryset = queryset.filter(business_id=business_id)
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(description__icontains=search))
        if status == "active":
            queryset = queryset.filter(is_active=True, is_archived=False)
        elif status == "inactive":
            queryset = queryset.filter(is_active=False, is_archived=False)
        elif status == "archived":
            manageable_business_ids = [
                business.id
                for business in accessible_businesses(self.request.user)
                if can(self.request.user, business, Resources.SETTINGS, Actions.UPDATE).allowed
            ]
            queryset = queryset.filter(
                business_id__in=manageable_business_ids,
                is_archived=True,
            )
        return queryset

    def get_access_resource(self):
        if self.action in {"list", "retrieve"}:
            return Resources.APPOINTMENTS
        return Resources.SETTINGS

    def get_access_action(self):
        if self.action in {"list", "retrieve"}:
            return Actions.VIEW
        return Actions.UPDATE

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        service = self.get_object()
        assert_can(request.user, service.business, Resources.SETTINGS, Actions.UPDATE, obj=service)
        service = set_service_active(
            request=request,
            service=service,
            is_active=True,
        )
        return Response(self.get_serializer(service).data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        service = self.get_object()
        assert_can(request.user, service.business, Resources.SETTINGS, Actions.UPDATE, obj=service)
        service = set_service_active(
            request=request,
            service=service,
            is_active=False,
        )
        return Response(self.get_serializer(service).data)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        service = self.get_object()
        assert_can(request.user, service.business, Resources.SETTINGS, Actions.UPDATE, obj=service)
        service = archive_service(
            request=request,
            service=service,
            reason=str(request.data.get("reason") or "").strip(),
        )
        return Response(self.get_serializer(service).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        service = self.get_object()
        assert_can(request.user, service.business, Resources.SETTINGS, Actions.UPDATE, obj=service)
        service = restore_service(request=request, service=service)
        return Response(self.get_serializer(service).data)

    def destroy(self, request, *args, **kwargs):
        service = self.get_object()
        assert_can(request.user, service.business, Resources.SETTINGS, Actions.UPDATE, obj=service)
        service = archive_service(
            request=request,
            service=service,
            reason=str(request.data.get("reason") or "").strip(),
        )
        return Response(status=204)
