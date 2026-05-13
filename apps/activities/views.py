from django.db.models import Q

from apps.activities.models import ActivityEvent, Note, Tag, TaggedObject
from apps.activities.serializers import ActivityEventSerializer, NoteSerializer, TagSerializer, TaggedObjectSerializer
from apps.core.viewsets import TenantModelViewSet


class ActivityEventViewSet(TenantModelViewSet):
    queryset = ActivityEvent.objects.select_related("business", "client", "actor")
    serializer_class = ActivityEventSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        business_id = self.request.query_params.get("business")
        client_id = self.request.query_params.get("client") or self.request.query_params.get("client_id")
        entity_type = self.request.query_params.get("entity_type")
        entity_id = self.request.query_params.get("entity_id")
        category = self.request.query_params.get("category")
        event_type = self.request.query_params.get("event_type")
        date_from = self.request.query_params.get("date_from") or self.request.query_params.get("created_after")
        date_to = self.request.query_params.get("date_to") or self.request.query_params.get("created_before")
        search = self.request.query_params.get("q")
        if business_id:
            queryset = queryset.filter(business_id=business_id)
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        if entity_id:
            queryset = queryset.filter(entity_id=str(entity_id))
        if category:
            queryset = queryset.filter(category=category)
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)
        if search:
            queryset = queryset.filter(Q(text__icontains=search) | Q(event_type__icontains=search))
        return queryset


class NoteViewSet(TenantModelViewSet):
    queryset = Note.objects.select_related("business", "client", "author")
    serializer_class = NoteSerializer


class TagViewSet(TenantModelViewSet):
    queryset = Tag.objects.select_related("business")
    serializer_class = TagSerializer


class TaggedObjectViewSet(TenantModelViewSet):
    queryset = TaggedObject.objects.select_related("business", "tag")
    serializer_class = TaggedObjectSerializer
