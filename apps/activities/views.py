from rest_framework.decorators import action
from rest_framework.response import Response

from apps.activities.models import ActivityEvent, Note, Segment, SegmentFilter, Tag, TaggedObject
from apps.activities.segments import evaluate_segment_queryset, refresh_segment_count
from apps.activities.serializers import (
    ActivityEventSerializer,
    ActivityTimelineSerializer,
    NoteSerializer,
    SegmentFilterSerializer,
    SegmentSerializer,
    TagSerializer,
    TaggedObjectSerializer,
)
from apps.clients.serializers import ClientSerializer
from apps.core.viewsets import TenantModelViewSet
from apps.activities.timeline_queries import (
    ActivityPagination, actor_choice, filter_timeline, read_timeline_query, timeline_actor_rows,
)


class ActivityEventViewSet(TenantModelViewSet):
    queryset = ActivityEvent.objects.select_related("business", "client", "actor")
    serializer_class = ActivityEventSerializer
    pagination_class = ActivityPagination

    def get_serializer_class(self):
        return ActivityTimelineSerializer if self.action in {"list", "retrieve"} else super().get_serializer_class()

    def get_queryset(self):
        queryset = super().get_queryset()
        values, business = read_timeline_query(self.request)
        if self.action == "actors":
            values = {"business": values.get("business")}
        return filter_timeline(queryset, values, business)

    @action(detail=False, methods=["get"])
    def actors(self, request):
        values, _business = read_timeline_query(request)
        queryset = self.get_queryset()
        rows = timeline_actor_rows(queryset, values.get("q", ""))
        page = self.paginate_queryset(rows)
        response = self.get_paginated_response([actor_choice(row) for row in page])
        selected = values.get("selected_actor")
        response.data["selected_actor"] = actor_choice(timeline_actor_rows(queryset).filter(actor_id=selected).first()) if selected else None
        return response


class NoteViewSet(TenantModelViewSet):
    queryset = Note.objects.select_related("business", "client", "author")
    serializer_class = NoteSerializer


class TagViewSet(TenantModelViewSet):
    queryset = Tag.objects.select_related("business")
    serializer_class = TagSerializer


class TaggedObjectViewSet(TenantModelViewSet):
    queryset = TaggedObject.objects.select_related("business", "tag")
    serializer_class = TaggedObjectSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        entity_type = self.request.query_params.get("entity_type")
        entity_id_list = self.parse_query_list("entity_id__in")
        entity_id = self.request.query_params.get("entity_id")
        tag_id = self.request.query_params.get("tag")
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        if entity_id_list:
            queryset = queryset.filter(entity_id__in=entity_id_list)
        if entity_id:
            queryset = queryset.filter(entity_id=str(entity_id))
        if tag_id:
            queryset = queryset.filter(tag_id=tag_id)
        return queryset


class SegmentViewSet(TenantModelViewSet):
    queryset = Segment.objects.select_related("business").prefetch_related("filters")
    serializer_class = SegmentSerializer

    @action(detail=True, methods=["get"])
    def evaluate(self, request, pk=None):
        segment = self.get_object()
        clients = evaluate_segment_queryset(segment)
        return Response(
            {
                "count": clients.count(),
                "clients": ClientSerializer(clients[:100], many=True).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="refresh-count")
    def refresh_count(self, request, pk=None):
        segment = self.get_object()
        count = refresh_segment_count(segment)
        return Response({"count": count, "segment": self.get_serializer(segment).data})


class SegmentFilterViewSet(TenantModelViewSet):
    queryset = SegmentFilter.objects.select_related("business", "segment")
    serializer_class = SegmentFilterSerializer

    def _business_from_serializer(self, serializer):
        business = super()._business_from_serializer(serializer)
        if business is None and "segment" in serializer.validated_data:
            business = serializer.validated_data["segment"].business
        return business
