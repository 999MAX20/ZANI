from django.db.models import Q

from apps.activities.models import ActivityEvent, Note, Tag, TaggedObject
from apps.activities.serializers import ActivityEventSerializer, NoteSerializer, TagSerializer, TaggedObjectSerializer
from apps.core.viewsets import TenantModelViewSet


class ActivityEventViewSet(TenantModelViewSet):
    queryset = ActivityEvent.objects.select_related("business", "client", "actor")
    serializer_class = ActivityEventSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        client_id = self.request.query_params.get("client_id")
        category = self.request.query_params.get("category")
        search = self.request.query_params.get("q")
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if category:
            queryset = queryset.filter(category=category)
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

