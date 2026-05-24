from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q, Sum
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.bots.ai import suggest_bot_reply
from apps.bots.inbox_service import assign_conversation, handoff_conversation, mark_conversation_read, send_outbound_message
from apps.bots.models import BotConversation, BotMessage
from apps.businesses.access import Actions, Resources, assert_can, can, scope_queryset
from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.clients.services import duplicate_payload, find_duplicate_clients
from apps.conversations.inbox_serializers import (
    InboxAssignSerializer,
    InboxConversationSerializer,
    InboxCreateClientSerializer,
    InboxCreateDealSerializer,
    InboxCreateLeadSerializer,
    InboxCreateTaskSerializer,
    InboxHandoffSerializer,
    InboxCloseSerializer,
    InboxPrioritySerializer,
    InboxLinkClientSerializer,
    InboxLinkDealSerializer,
    InboxLinkLeadSerializer,
    InboxMessageSerializer,
    InboxOutboundMessageSerializer,
)
from apps.core.permissions import accessible_businesses
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.crm.serializers import DealSerializer
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
            "deal",
            "assigned_to",
        ).prefetch_related("messages")
        businesses = list(accessible_businesses(self.request.user))
        filtered = queryset.filter(business__in=businesses)
        scoped_queryset = queryset.none()
        for business in businesses:
            if not can(self.request.user, business, Resources.CONVERSATIONS, Actions.VIEW).allowed:
                continue
            scoped_queryset = scoped_queryset | scope_queryset(
                filtered.filter(business=business),
                self.request.user,
                business,
                Resources.CONVERSATIONS,
                Actions.VIEW,
            )
        return self._apply_filters(scoped_queryset.distinct())

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Return owner/manager friendly inbox health for the mobile dashboard.

        This endpoint intentionally does not promise full production omnichannel.
        It summarizes the channels already flowing through the inbox and shows
        WhatsApp/Instagram as pilot roadmap channels when they are not connected yet.
        """
        queryset = self.get_queryset()
        total = queryset.count()
        unread = queryset.filter(unread_count__gt=0).count()
        handoff_required = queryset.filter(handoff_required=True).count()
        assigned_to_me = queryset.filter(assigned_to=request.user).count()
        unassigned = queryset.filter(assigned_to__isnull=True).count()
        urgent = queryset.filter(priority=BotConversation.Priorities.URGENT).count()
        high_priority = queryset.filter(priority__in=[BotConversation.Priorities.HIGH, BotConversation.Priorities.URGENT]).count()
        bot_paused = queryset.filter(bot_enabled=False).count()

        channel_rows = queryset.values("channel").annotate(
            total=Count("id"),
            unread=Sum("unread_count"),
            handoff_required=Count("id", filter=Q(handoff_required=True)),
            last_message_at=Max("last_message_at"),
        )
        channel_map = {row["channel"]: row for row in channel_rows}
        channel_catalog = [
            {
                "key": BotConversation.Channels.WEBSITE,
                "label": "Website / landing chat",
                "status": "available",
                "pilot_note": "Готово для пилота: сообщения с сайта/лендинга попадают в единый inbox.",
            },
            {
                "key": BotConversation.Channels.TELEGRAM,
                "label": "Telegram",
                "status": "beta",
                "pilot_note": "Beta: можно проверять через подключенный bot token/staging.",
            },
            {
                "key": BotConversation.Channels.WHATSAPP,
                "label": "WhatsApp",
                "status": "roadmap",
                "pilot_note": "На пилоте используем WhatsApp-кнопку. Production API подключается отдельно.",
            },
            {
                "key": BotConversation.Channels.INSTAGRAM,
                "label": "Instagram Direct",
                "status": "roadmap",
                "pilot_note": "Показываем как следующий модуль, не обещаем как готовую production-интеграцию.",
            },
        ]
        channels = []
        for item in channel_catalog:
            row = channel_map.get(item["key"], {})
            channels.append(
                {
                    **item,
                    "total": row.get("total", 0) or 0,
                    "unread": row.get("unread", 0) or 0,
                    "handoff_required": row.get("handoff_required", 0) or 0,
                    "last_message_at": row.get("last_message_at"),
                    "is_connected": bool(row.get("total")) or item["status"] == "available",
                }
            )

        next_actions = []
        if unread:
            next_actions.append({"label": "Разобрать непрочитанные", "href": "/dashboard/inbox?unread=true", "priority": "high"})
        if handoff_required:
            next_actions.append({"label": "Забрать диалоги у бота", "href": "/dashboard/inbox?handoff_required=true", "priority": "high"})
        if unassigned:
            next_actions.append({"label": "Назначить ответственных", "href": "/dashboard/inbox?assigned_to=unassigned", "priority": "normal"})
        if total == 0:
            next_actions.append({"label": "Подключить website chat", "href": "/dashboard/integrations", "priority": "normal"})

        return Response(
            {
                "total": total,
                "unread": unread,
                "handoff_required": handoff_required,
                "assigned_to_me": assigned_to_me,
                "unassigned": unassigned,
                "urgent": urgent,
                "high_priority": high_priority,
                "bot_paused": bot_paused,
                "channels": channels,
                "next_actions": next_actions,
                "pilot_positioning": "Unified Inbox собирает обращения с сайта/лендинга и beta-каналов в одном месте. WhatsApp/Instagram отмечены как roadmap, чтобы маркетинг не обещал production раньше времени.",
            }
        )

    def _apply_filters(self, queryset):
        params = self.request.query_params

        for field in ["channel", "status", "priority"]:
            value = params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})

        assigned_to = params.get("assigned_to")
        if assigned_to == "me":
            queryset = queryset.filter(assigned_to=self.request.user)
        elif assigned_to == "unassigned":
            queryset = queryset.filter(assigned_to__isnull=True)
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

        handoff_required = params.get("handoff_required")
        if handoff_required == "true":
            queryset = queryset.filter(handoff_required=True)
        elif handoff_required == "false":
            queryset = queryset.filter(handoff_required=False)

        search = (params.get("search") or params.get("q") or "").strip()
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
            assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
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
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.MANAGE, obj=conversation)
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
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxHandoffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation = handoff_conversation(conversation, serializer.validated_data.get("reason", ""))
        return Response(self.get_serializer(conversation).data)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        conversation = mark_conversation_read(conversation)
        return Response(self.get_serializer(conversation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="mark-unread")
    def mark_unread(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        conversation.unread_count = max(conversation.unread_count, 1)
        conversation.save(update_fields=["unread_count", "updated_at"])
        return Response(self.get_serializer(conversation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="set-priority")
    def set_priority(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxPrioritySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conversation.priority = serializer.validated_data["priority"]
        conversation.save(update_fields=["priority", "updated_at"])
        return Response(self.get_serializer(conversation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation.status = BotConversation.Statuses.CLOSED
        conversation.close_reason = serializer.validated_data.get("reason", "")
        conversation.handoff_required = False
        conversation.bot_enabled = False
        conversation.save(update_fields=["status", "close_reason", "handoff_required", "bot_enabled", "updated_at"])
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.OUTBOUND,
            sender_type=BotMessage.SenderTypes.SYSTEM,
            text="Диалог закрыт менеджером.",
            status=BotMessage.Statuses.SENT,
        )
        return Response(self.get_serializer(conversation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)

        conversation.status = BotConversation.Statuses.OPEN
        conversation.close_reason = ""
        conversation.save(update_fields=["status", "close_reason", "updated_at"])
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.OUTBOUND,
            sender_type=BotMessage.SenderTypes.SYSTEM,
            text="Диалог возвращён в работу.",
            status=BotMessage.Statuses.SENT,
        )
        return Response(self.get_serializer(conversation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="suggest-reply")
    def suggest_reply(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        result, log, message_context = suggest_bot_reply(conversation=conversation, user=request.user)
        return Response(
            {
                "suggested_reply": result.output_text,
                "is_mock": result.is_mock,
                "model": result.model,
                "tokens_used": result.tokens_used,
                "log_id": log.id,
                "messages_used": len(message_context),
                "client_id": conversation.client_id,
                "lead_id": conversation.lead_id,
            }
        )

    @action(detail=True, methods=["post"], url_path="create-task")
    def create_task(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.TASKS, Actions.CREATE)
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
        assert_can(request.user, conversation.business, Resources.LEADS, Actions.UPDATE)
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
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

    @action(detail=True, methods=["post"], url_path="link-client")
    def link_client(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CLIENTS, Actions.UPDATE)
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxLinkClientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        client = Client.objects.filter(id=serializer.validated_data["client_id"], business=conversation.business).first()
        if client is None:
            raise ValidationError({"client_id": "Client was not found in this business."})
        conversation.client = client
        conversation.save(update_fields=["client", "updated_at"])
        return Response(self.get_serializer(conversation).data)

    @action(detail=True, methods=["post"], url_path="create-client")
    def create_client(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CLIENTS, Actions.CREATE)
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxCreateClientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if conversation.client_id:
            return Response({"client": ClientSerializer(conversation.client).data, "duplicates": [], "created": False})

        full_name = serializer.validated_data.get("full_name") or conversation.external_user_id or conversation.external_thread_id or f"Inbox visitor #{conversation.id}"
        phone = serializer.validated_data.get("phone", "")
        email = serializer.validated_data.get("email", "")
        duplicates = find_duplicate_clients(conversation.business, phone=phone, email=email)
        if duplicates and not serializer.validated_data.get("force_create", False):
            return Response(
                {
                    "client": None,
                    "duplicates": duplicate_payload(duplicates, phone=phone, email=email),
                    "created": False,
                    "requires_confirmation": True,
                },
                status=status.HTTP_200_OK,
            )

        client = Client.objects.create(
            business=conversation.business,
            full_name=full_name,
            phone=phone,
            email=email,
            source=self._source_from_channel(conversation.channel),
        )
        conversation.client = client
        conversation.save(update_fields=["client", "updated_at"])
        return Response({"client": ClientSerializer(client).data, "duplicates": [], "created": True}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="create-lead")
    def create_lead(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.LEADS, Actions.CREATE)
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
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

    @action(detail=True, methods=["post"], url_path="link-deal")
    def link_deal(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.DEALS, Actions.UPDATE)
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxLinkDealSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        deal = Deal.objects.filter(id=serializer.validated_data["deal_id"], business=conversation.business).first()
        if deal is None:
            raise ValidationError({"deal_id": "Deal was not found in this business."})
        conversation.deal = deal
        if conversation.client is None:
            conversation.client = deal.client
        if conversation.lead is None and deal.lead_id:
            conversation.lead = deal.lead
        conversation.save(update_fields=["deal", "client", "lead", "updated_at"])
        return Response(self.get_serializer(conversation).data)

    @action(detail=True, methods=["post"], url_path="create-deal")
    def create_deal(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.DEALS, Actions.CREATE)
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxCreateDealSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if conversation.deal_id:
            return Response(DealSerializer(conversation.deal).data)

        client = conversation.client or self._create_client_from_conversation(conversation)
        lead = conversation.lead
        pipeline, stage = self._default_pipeline_and_stage(conversation.business)
        title = serializer.validated_data.get("title") or f"Deal: {client.full_name}"
        deal = Deal.objects.create(
            business=conversation.business,
            client=client,
            lead=lead,
            pipeline=pipeline,
            stage=stage,
            title=title,
            amount=serializer.validated_data.get("amount", 0),
            currency=serializer.validated_data.get("currency") or "KZT",
            owner=request.user,
            source=self._source_from_channel(conversation.channel),
        )
        conversation.client = client
        conversation.deal = deal
        conversation.save(update_fields=["client", "deal", "updated_at"])
        return Response(DealSerializer(deal).data, status=status.HTTP_201_CREATED)

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

    def _default_pipeline_and_stage(self, business):
        pipeline = Pipeline.objects.filter(business=business, is_default=True).first() or Pipeline.objects.filter(business=business).first()
        if pipeline is None:
            pipeline = Pipeline.objects.create(business=business, name="Sales Pipeline", slug="sales", is_default=True)
        stage = PipelineStage.objects.filter(business=business, pipeline=pipeline).order_by("order", "id").first()
        if stage is None:
            stage = PipelineStage.objects.create(business=business, pipeline=pipeline, name="New", order=1, probability=10)
        return pipeline, stage

    def _last_message_text(self, conversation):
        message = conversation.messages.order_by("-created_at").first()
        return message.text if message else ""
