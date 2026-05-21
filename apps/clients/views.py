from rest_framework.decorators import action
from rest_framework.response import Response

from apps.activities.models import Segment, TaggedObject
from apps.activities.segments import evaluate_segment_queryset
from apps.clients.models import Client
from apps.clients.serializers import ClientMergeSerializer, ClientSerializer, DuplicateCheckSerializer
from apps.core.audit import write_audit_log
from apps.core.crm_cards import client_crm_card
from apps.core.models import AuditLog
from apps.core.viewsets import TenantModelViewSet


class ClientViewSet(TenantModelViewSet):
    queryset = Client.objects.select_related("business")
    serializer_class = ClientSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("q") or self.request.query_params.get("search")
        source = self.request.query_params.get("source")
        tag_id = self.request.query_params.get("tag")
        segment_id = self.request.query_params.get("segment")
        if search:
            queryset = queryset.filter(full_name__icontains=search) | queryset.filter(phone__icontains=search) | queryset.filter(email__icontains=search)
        if source:
            queryset = queryset.filter(source=source)
        if tag_id:
            client_ids = TaggedObject.objects.filter(
                business_id__in=queryset.values_list("business_id", flat=True),
                entity_type="client",
                tag_id=tag_id,
            ).values_list("entity_id", flat=True)
            queryset = queryset.filter(id__in=client_ids)
        if segment_id:
            segment = Segment.objects.filter(id=segment_id).first()
            if segment is None:
                return queryset.none()
            segment_ids = evaluate_segment_queryset(segment).values_list("id", flat=True)
            queryset = queryset.filter(id__in=segment_ids)
        return queryset.distinct()

    @action(detail=True, methods=["get"], url_path="crm-card")
    def crm_card(self, request, pk=None):
        client = self.get_object()
        return Response(client_crm_card(client))

    @action(detail=False, methods=["post"], url_path="check-duplicates")
    def check_duplicates(self, request):
        serializer = DuplicateCheckSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response({"duplicates": serializer.duplicates()})

    @action(detail=True, methods=["post"])
    def merge(self, request, pk=None):
        target_client = self.get_object()
        serializer = ClientMergeSerializer(data=request.data, context={"request": request, "target_client": target_client})
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        write_audit_log(request, AuditLog.Actions.UPDATE, target_client, metadata={"merge": result})
        return Response(result)
