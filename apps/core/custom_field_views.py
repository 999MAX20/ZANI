from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.businesses.models import Business
from apps.core.models import CustomFieldDefinition, CustomFieldValue
from apps.core.permissions import user_can_access_business
from apps.core.serializers import BulkCustomFieldValueSerializer, CustomFieldDefinitionSerializer, CustomFieldValueSerializer
from apps.core.viewsets import TenantModelViewSet


class CustomFieldDefinitionViewSet(TenantModelViewSet):
    queryset = CustomFieldDefinition.objects.select_related("business")
    serializer_class = CustomFieldDefinitionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        entity_type = self.request.query_params.get("entity_type")
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        return queryset


class CustomFieldValueViewSet(TenantModelViewSet):
    queryset = CustomFieldValue.objects.select_related("business", "definition")
    serializer_class = CustomFieldValueSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        entity_type = self.request.query_params.get("entity_type")
        entity_id = self.request.query_params.get("entity_id")
        definition = self.request.query_params.get("definition")
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        if entity_id:
            queryset = queryset.filter(entity_id=str(entity_id))
        if definition:
            queryset = queryset.filter(definition_id=definition)
        return queryset

    @action(detail=False, methods=["post"], url_path="bulk-upsert")
    def bulk_upsert(self, request):
        serializer = BulkCustomFieldValueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        business = Business.objects.filter(id=serializer.validated_data["business"]).first()
        if business is None or not user_can_access_business(request.user, business):
            raise PermissionDenied("Business is not available.")

        entity_type = serializer.validated_data["entity_type"]
        entity_id = serializer.validated_data["entity_id"]
        saved = []
        for item in serializer.validated_data["values"]:
            definition = item["definition"]
            if definition.business_id != business.id or definition.entity_type != entity_type:
                raise ValidationError({"definition": "Definition does not belong to this business/entity."})
            value, _ = CustomFieldValue.objects.update_or_create(
                business=business,
                definition=definition,
                entity_type=entity_type,
                entity_id=str(entity_id),
                defaults={"value_json": item.get("value_json", {})},
            )
            saved.append(value)

        return Response(CustomFieldValueSerializer(saved, many=True).data)
