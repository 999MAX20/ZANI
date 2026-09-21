from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.core.permissions import IsTenantMember
from .selectors import filter_payments, payment_business, payment_options, payment_queryset
from .serializers import PaymentOptionQuerySerializer, PaymentQuerySerializer, PaymentSerializer, PaymentWriteSerializer
from .services import record_payment


class PaymentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class PaymentViewSet(GenericViewSet):
    lookup_value_regex = r"\d+"
    permission_classes = [IsTenantMember]
    serializer_class = PaymentSerializer
    pagination_class = PaymentPagination

    def get_queryset(self):
        business = payment_business(self.request.user, self.request.query_params.get("business"))
        return payment_queryset(self.request.user, business)

    def list(self, request):
        filters = PaymentQuerySerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        queryset = filter_payments(self.get_queryset(), filters.validated_data)
        return self.get_paginated_response(self.get_serializer(self.paginate_queryset(queryset), many=True).data)

    def retrieve(self, request, pk=None):
        return Response(self.get_serializer(get_object_or_404(self.get_queryset(), pk=pk)).data)

    def create(self, request):
        serializer = PaymentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment, replayed = record_payment(actor=request.user, data=serializer.validated_data)
        return Response(self.get_serializer(payment).data, status=200 if replayed else 201)

    @action(detail=False, methods=["get"], url_path="link-options")
    def link_options(self, request):
        business = payment_business(request.user, request.query_params.get("business"))
        serializer = PaymentOptionQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        params = serializer.validated_data
        queryset = payment_options(request.user, business, kind=params["kind"],
                                   client_id=params.get("client"), query=params.get("q", ""))
        page = self.paginate_queryset(queryset)
        items = []
        for obj in page:
            if params["kind"] == "client":
                label = obj.full_name
            elif params["kind"] == "deal":
                label = obj.title
            else:
                label = obj.service.name
            items.append({"id": obj.pk, "label": label,
                          "occurred_at": obj.start_at.isoformat() if params["kind"] == "appointment" else None})
        return self.get_paginated_response(items)
