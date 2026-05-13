from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.bots.inbox_service import assign_conversation, handoff_conversation, mark_conversation_read, send_outbound_message
from apps.bots.models import BotConversation, BotMessage
from apps.clients.models import Client
from apps.conversations.inbox_serializers import (
    InboxAssignSerializer,
    InboxConversationSerializer,
    InboxCreateLeadSerializer,
    InboxCreateTaskSerializer,
    InboxHandoffSerializer,
    InboxLinkLeadSerializer,
    InboxMessageSerializer,
    InboxOutboundMessageSerializer,
)
from apps.core.permissions import accessible_businesses
from apps.leads.models import Lead
from apps.leads.serializers import LeadSerializer
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer


class IsMerchantInboxUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "is_merchant_user", False))


class InboxConversationViewSet(ReadOnlyModelViewSet):
    serializer_class = InboxConversationSerializer
    permission_classes = [IsMerchantInboxUser]

    def get_queryset(self):
        queryset = BotConversation.objects.select_related(
            "business",
            "bot",
            "client",
            "lead",
            "assigned_to",
        ).prefetch_related("messages")
        queryset = queryset.filter(business__in=accessible_businesses(self.request.user))
        return self._apply_filters(queryset)

    def _apply_filters(self, queryset):
        params = self.request.query_params

        for field in ["channel", "status", "priority"]:
            value = params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})

        assigned_to = params.get("assigned_to")
        if assigned_to == "me":
            queryset = queryset.filter(assigned_to=self.request.user)
        elif assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)

        bot_enabled = params.get("bot_enabled")
        if bot_enabled in {"true", "false"}:
            queryset = queryset.filter(bot_enabled=bot_enabled == "true")

        unread = params.get("unread")
        if unread == "true":
            queryset = queryset.filter(unread_count__gt=0)
        elif unread == "false":
            queryset = queryset.filter(unread_count=0)

        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(external_user_id__icontains=search)
                | Q(external_thread_id__icontains=search)
                | Q(client__full_name__icontains=search)
                | Q(client__phone__icontains=search)
                | Q(client__email__icontains=search)
                | Q(messages__text__icontains=search)
            ).distinct()

        return queryset

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        if request.method == "POST":
            serializer = InboxOutboundMessageSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            message = send_outbound_message(
                conversation=conversation,
                text=serializer.validated_data["text"],
                user=request.user,
                sender_type=BotMessage.SenderTypes.MANAGER,
            )
            return Response(InboxMessageSerializer(message).data, status=status.HTTP_201_CREATED)

        messages = conversation.messages.order_by("created_at")
        serializer = InboxMessageSerializer(messages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        conversation = self.get_object()
        serializer = InboxAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignee = request.user
        user_id = serializer.validated_data.get("user_id")
        if user_id is not None:
            assignee = get_user_model().objects.filter(id=user_id).first()
            if assignee is None:
                raise ValidationError({"user_id": "User was not found."})

        if not conversation.business.members.filter(user=assignee, is_active=True).exists():
            raise PermissionDenied("Assignee must be an active member of this business.")

        conversation = assign_conversation(conversation, assignee)
        return Response(self.get_serializer(conversation).data)

    @action(detail=True, methods=["post"])
    def handoff(self, request, pk=None):
        conversation = self.get_object()
        serializer = InboxHandoffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation = handoff_conversation(conversation, serializer.validated_data.get("reason", ""))
        return Response(self.get_serializer(conversation).data)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        conversation = mark_conversation_read(self.get_object())
        return Response(self.get_serializer(conversation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="create-task")
    def create_task(self, request, pk=None):
        conversation = self.get_object()
        serializer = InboxCreateTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        title = serializer.validated_data.get("title") or f"Follow up: {conversation.client or conversation.external_user_id or conversation.id}"
        task = Task.objects.create(
            business=conversation.business,
            title=title,
            description=serializer.validated_data.get("description", ""),
            client=conversation.client,
            lead=conversation.lead,
            assignee=request.user,
            created_by=request.user,
            priority=serializer.validated_data.get("priority", Task.Priorities.NORMAL),
            due_at=serializer.validated_data.get("due_at"),
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="link-lead")
    def link_lead(self, request, pk=None):
        conversation = self.get_object()
        serializer = InboxLinkLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lead = Lead.objects.filter(id=serializer.validated_data["lead_id"], business=conversation.business).first()
        if lead is None:
            raise ValidationError({"lead_id": "Lead was not found in this business."})
        conversation.lead = lead
        if conversation.client is None:
            conversation.client = lead.client
        conversation.save(update_fields=["lead", "client", "updated_at"])
        return Response(self.get_serializer(conversation).data)

    @action(detail=True, methods=["post"], url_path="create-lead")
    def create_lead(self, request, pk=None):
        conversation = self.get_object()
        serializer = InboxCreateLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if conversation.lead_id:
            return Response(LeadSerializer(conversation.lead).data)

        client = conversation.client or self._create_client_from_conversation(conversation)
        lead = Lead.objects.create(
            business=conversation.business,
            client=client,
            source=self._source_from_channel(conversation.channel),
            message=serializer.validated_data.get("message") or self._last_message_text(conversation),
            responsible_user=request.user,
        )
        conversation.client = client
        conversation.lead = lead
        conversation.save(update_fields=["client", "lead", "updated_at"])
        return Response(LeadSerializer(lead).data, status=status.HTTP_201_CREATED)

    def _source_from_channel(self, channel):
        allowed_sources = {choice[0] for choice in Lead.Sources.choices}
        return channel if channel in allowed_sources else Lead.Sources.OTHER

    def _create_client_from_conversation(self, conversation):
        full_name = conversation.external_user_id or conversation.external_thread_id or f"Inbox visitor #{conversation.id}"
        return Client.objects.create(
            business=conversation.business,
            full_name=full_name,
            source=self._source_from_channel(conversation.channel),
        )

    def _last_message_text(self, conversation):
        message = conversation.messages.order_by("-created_at").first()
        return message.text if message else ""
