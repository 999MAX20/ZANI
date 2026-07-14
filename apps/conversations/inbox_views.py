from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.activities.taxonomy import ActivityEvents
from apps.bots.ai import suggest_bot_reply
from apps.bots.inbox_service import (
    assign_conversation,
    close_conversation,
    handoff_conversation,
    mark_conversation_read,
    mark_conversation_unread,
    record_inbox_crm_activity,
    record_message_retry,
    reopen_conversation,
    send_outbound_message,
    set_conversation_priority,
)
from apps.bots.models import BotConversation, BotMessage
from apps.businesses.access import Actions, Resources, assert_can, can, scope_queryset
from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.clients.services import duplicate_payload, find_duplicate_clients
from apps.conversations.inbox_serializers import (
    InboxAssignSerializer,
    InboxCreateAppointmentSerializer,
    InboxConversationSerializer,
    InboxCreateClientSerializer,
    InboxCreateDealSerializer,
    InboxCreateLeadSerializer,
    InboxCreateTaskSerializer,
    InboxHandoffSerializer,
    InboxCloseSerializer,
    InboxPrioritySerializer,
    InboxRetryMessageSerializer,
    InboxLinkClientSerializer,
    InboxLinkDealSerializer,
    InboxLinkLeadSerializer,
    InboxMessageSerializer,
    InboxOutboundMessageSerializer,
    InboxRunPipelineSerializer,
)
from apps.conversations.ai_qualification import qualification_from_payload, qualify_conversation
from apps.conversations.booking import create_appointment_from_conversation
from apps.conversations.pipeline import default_pipeline_and_stage, last_message_text, run_conversation_pipeline, source_from_channel
from apps.core.permissions import accessible_businesses
from apps.core.work_queues import (
    handoff_conversations_queryset,
    overdue_handoff_conversations_queryset,
    unread_conversations_queryset,
    unread_sla_overdue_conversations_queryset,
)
from apps.crm.models import Deal
from apps.crm.serializers import DealSerializer
from apps.leads.models import Lead
from apps.leads.serializers import LeadSerializer
from apps.scheduling.serializers import AppointmentSerializer
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer


QUALIFICATION_PREVIEW_META_KEY = "conversation_qualification_preview"


class IsMerchantInboxUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "is_merchant_user", False))


class InboxConversationViewSet(ReadOnlyModelViewSet):
    DEFAULT_MESSAGE_PAGE_SIZE = 200
    MAX_MESSAGE_PAGE_SIZE = 300

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
        unread = unread_conversations_queryset(queryset=queryset).count()
        unread_messages = queryset.aggregate(total=Sum("unread_count"))["total"] or 0
        handoff_required = handoff_conversations_queryset(queryset=queryset).count()
        unread_sla_overdue = unread_sla_overdue_conversations_queryset(queryset=queryset).count()
        handoff_sla_overdue = overdue_handoff_conversations_queryset(queryset=queryset).count()
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
        if handoff_sla_overdue:
            next_actions.append({"label": "Handoff SLA overdue", "href": "/app/inbox?handoff_required=true", "priority": "urgent"})
        if unread_sla_overdue:
            next_actions.append({"label": "Unread SLA overdue", "href": "/app/inbox?unread=true", "priority": "urgent"})
        if unread:
            next_actions.append({"label": "Разобрать непрочитанные", "href": "/app/inbox?unread=true", "priority": "high"})
        if handoff_required:
            next_actions.append({"label": "Забрать диалоги у бота", "href": "/app/inbox?handoff_required=true", "priority": "high"})
        if unassigned:
            next_actions.append({"label": "Назначить ответственных", "href": "/app/inbox?assigned_to=unassigned", "priority": "normal"})
        if total == 0:
            next_actions.append({"label": "Подключить website chat", "href": "/app/integrations", "priority": "normal"})

        return Response(
            {
                "total": total,
                "unread": unread,
                "unread_messages": unread_messages,
                "handoff_required": handoff_required,
                "unread_sla_overdue": unread_sla_overdue,
                "handoff_sla_overdue": handoff_sla_overdue,
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

        bot = params.get("bot")
        if bot:
            queryset = queryset.filter(bot_id=bot)

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

        limit_param = request.query_params.get("limit", self.DEFAULT_MESSAGE_PAGE_SIZE)
        try:
            limit = int(limit_param)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid limit parameter. Expected integer."}, status=status.HTTP_400_BAD_REQUEST)
        if limit < 1 or limit > self.MAX_MESSAGE_PAGE_SIZE:
            return Response({"detail": f"Invalid limit parameter. Must be between 1 and {self.MAX_MESSAGE_PAGE_SIZE}."}, status=status.HTTP_400_BAD_REQUEST)

        before_id_param = request.query_params.get("before_id")
        if before_id_param is not None:
            try:
                before_id = int(before_id_param)
            except (TypeError, ValueError):
                return Response({"detail": "Invalid before_id parameter. Expected integer."}, status=status.HTTP_400_BAD_REQUEST)
            if before_id < 1:
                return Response({"detail": "Invalid before_id parameter. Must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)
            message_query = conversation.messages.filter(id__lt=before_id)
        else:
            message_query = conversation.messages.all()

        message_window = list(message_query.order_by("-created_at", "-id")[: limit + 1])
        has_more = len(message_window) > limit
        page_messages = message_window[:limit]
        next_before_id = None
        if has_more:
            next_before_id = message_window[limit].id

        messages = list(reversed(page_messages))
        serializer = InboxMessageSerializer(messages, many=True)
        return Response({
            "count": conversation.messages.count(),
            "next": str(next_before_id) if next_before_id else None,
            "previous": None,
            "results": serializer.data,
            "next_before_id": next_before_id,
            "has_more": has_more,
        })

    @action(detail=True, methods=["post"], url_path="retry-message")
    def retry_message(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxRetryMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        original = conversation.messages.filter(id=serializer.validated_data["message_id"]).first()
        if original is None:
            raise ValidationError({"message_id": "Message was not found in this conversation."})
        if original.direction != BotMessage.Directions.OUTBOUND:
            raise ValidationError({"message_id": "Only outbound messages can be retried."})
        if original.sender_type == BotMessage.SenderTypes.SYSTEM:
            raise ValidationError({"message_id": "System messages cannot be retried."})
        if original.status == BotMessage.Statuses.SENT:
            raise ValidationError({"message_id": "Sent messages do not need retry."})

        retried = send_outbound_message(
            conversation=conversation,
            text=original.text,
            user=request.user,
            sender_type=original.sender_type,
        )
        retried.payload_json = {
            **(retried.payload_json or {}),
            "retry_of_message_id": original.id,
        }
        retried.save(update_fields=["payload_json"])
        record_message_retry(conversation, original_message=original, retried_message=retried, actor=request.user)
        return Response(InboxMessageSerializer(retried).data, status=status.HTTP_201_CREATED)

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

        conversation = assign_conversation(conversation, assignee, actor=request.user)
        return Response(self.get_serializer(conversation).data)

    @action(detail=True, methods=["post"])
    def handoff(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxHandoffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation = handoff_conversation(conversation, serializer.validated_data.get("reason", ""), actor=request.user)
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
        conversation = mark_conversation_unread(conversation, actor=request.user)
        return Response(self.get_serializer(conversation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="set-priority")
    def set_priority(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxPrioritySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conversation = set_conversation_priority(conversation, serializer.validated_data["priority"], actor=request.user)
        return Response(self.get_serializer(conversation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation = close_conversation(conversation, reason=serializer.validated_data.get("reason", ""), actor=request.user)
        return Response(self.get_serializer(conversation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)

        conversation = reopen_conversation(conversation, actor=request.user)
        return Response(self.get_serializer(conversation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="suggest-reply")
    def suggest_reply(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        assert_can(request.user, conversation.business, Resources.AI_ASSISTANT, Actions.SUGGEST, obj=conversation)
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
            deal=conversation.deal,
            conversation=conversation,
            assignee=request.user,
            created_by=request.user,
            priority=serializer.validated_data.get("priority", Task.Priorities.NORMAL),
            due_at=serializer.validated_data.get("due_at"),
        )
        record_inbox_crm_activity(
            conversation,
            entity=task,
            event_type=ActivityEvents.TASK_CREATED,
            actor=request.user,
            text="Task created from inbox conversation.",
            metadata={"task_id": task.id, "client_id": task.client_id, "lead_id": task.lead_id, "deal_id": task.deal_id},
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="create-appointment")
    def create_appointment(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.APPOINTMENTS, Actions.CREATE)
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxCreateAppointmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            appointment = create_appointment_from_conversation(
                conversation=conversation,
                service_id=serializer.validated_data["service_id"],
                resource_id=serializer.validated_data.get("resource_id"),
                start_at=serializer.validated_data["start_at"],
                notes=serializer.validated_data.get("notes", ""),
                actor=request.user,
            )
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="qualify")
    def qualify(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        assert_can(request.user, conversation.business, Resources.AI_PIPELINE, Actions.SUGGEST, obj=conversation)

        qualification, ai_log = qualify_conversation(conversation=conversation, user=request.user)
        preview_payload = {
            "qualification": qualification.to_dict(),
            "ai_log_id": ai_log.id if ai_log else None,
            "qualified_at": timezone.now().isoformat(),
            "qualified_by": request.user.id if request.user and request.user.is_authenticated else None,
            "last_message_id": self._last_message_id(conversation),
        }
        metadata = dict(conversation.metadata_json or {})
        metadata[QUALIFICATION_PREVIEW_META_KEY] = preview_payload
        conversation.metadata_json = metadata
        conversation.save(update_fields=["metadata_json", "updated_at"])
        record_inbox_crm_activity(
            conversation,
            entity=conversation.client or conversation,
            event_type=ActivityEvents.CONVERSATION_QUALIFICATION_PREVIEWED,
            actor=request.user,
            text="Conversation AI qualification previewed.",
            metadata={
                "ai_log_id": preview_payload["ai_log_id"],
                "intent": qualification.intent,
                "confidence": qualification.confidence,
                "last_message_id": preview_payload["last_message_id"],
            },
        )
        return Response(
            {
                "conversation": self.get_serializer(conversation).data,
                **preview_payload,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="run-pipeline")
    def run_pipeline(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        assert_can(request.user, conversation.business, Resources.AI_PIPELINE, Actions.EXECUTE, obj=conversation)
        assert_can(request.user, conversation.business, Resources.CLIENTS, Actions.CREATE)
        serializer = InboxRunPipelineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.get("create_lead", True):
            assert_can(request.user, conversation.business, Resources.LEADS, Actions.CREATE)
        if data.get("create_deal", True):
            assert_can(request.user, conversation.business, Resources.DEALS, Actions.CREATE)
        if data.get("create_task", True):
            assert_can(request.user, conversation.business, Resources.TASKS, Actions.CREATE)

        qualification_override = None
        ai_log_id_override = None
        if data.get("use_ai_qualification", True) and any(
            [data.get("create_lead", True), data.get("create_deal", True), data.get("create_task", True)]
        ):
            preview_payload = self._qualification_preview_for_execution(conversation)
            qualification_override = qualification_from_payload(preview_payload["qualification"])
            ai_log_id_override = preview_payload.get("ai_log_id")

        result = run_conversation_pipeline(
            conversation=conversation,
            actor=request.user,
            create_lead=data.get("create_lead", True),
            create_deal=data.get("create_deal", True),
            create_task=data.get("create_task", True),
            lead_message=data.get("lead_message", ""),
            deal_title=data.get("deal_title", ""),
            deal_amount=data.get("deal_amount", 0),
            deal_currency=data.get("deal_currency") or "KZT",
            task_title=data.get("task_title", ""),
            task_description=data.get("task_description", ""),
            task_priority=data.get("task_priority", Task.Priorities.NORMAL),
            task_due_at=data.get("task_due_at"),
            use_ai_qualification=data.get("use_ai_qualification", True),
            apply_ai_decisions=data.get("apply_ai_decisions", True),
            qualification_override=qualification_override,
            ai_log_id_override=ai_log_id_override,
        )
        return Response(
            {
                "conversation": self.get_serializer(result.conversation).data,
                "client": ClientSerializer(result.client).data,
                "lead": LeadSerializer(result.lead).data if result.lead else None,
                "deal": DealSerializer(result.deal).data if result.deal else None,
                "task": TaskSerializer(result.task).data if result.task else None,
                "created": result.created,
                "qualification": result.qualification.to_dict() if result.qualification else None,
                "ai_log_id": result.ai_log_id,
            },
            status=status.HTTP_200_OK,
        )

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
        record_inbox_crm_activity(
            conversation,
            entity=lead,
            event_type=ActivityEvents.CONVERSATION_LEAD_LINKED,
            actor=request.user,
            text="Conversation linked to lead.",
            metadata={"lead_id": lead.id, "client_id": lead.client_id},
        )
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
        record_inbox_crm_activity(
            conversation,
            entity=client,
            event_type=ActivityEvents.CONVERSATION_CLIENT_LINKED,
            actor=request.user,
            text="Conversation linked to client.",
            metadata={"client_id": client.id},
        )
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
        record_inbox_crm_activity(
            conversation,
            entity=client,
            event_type=ActivityEvents.CLIENT_CREATED,
            actor=request.user,
            text="Client created from inbox conversation.",
            metadata={"client_id": client.id, "channel": conversation.channel},
        )
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

        result = run_conversation_pipeline(
            conversation=conversation,
            actor=request.user,
            create_lead=True,
            create_deal=False,
            create_task=False,
            lead_message=serializer.validated_data.get("message", ""),
            use_ai_qualification=False,
        )
        return Response(LeadSerializer(result.lead).data, status=status.HTTP_201_CREATED)

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
        record_inbox_crm_activity(
            conversation,
            entity=deal,
            event_type=ActivityEvents.CONVERSATION_DEAL_LINKED,
            actor=request.user,
            text="Conversation linked to deal.",
            metadata={"deal_id": deal.id, "client_id": deal.client_id, "lead_id": deal.lead_id},
        )
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

        result = run_conversation_pipeline(
            conversation=conversation,
            actor=request.user,
            create_lead=True,
            create_deal=True,
            create_task=False,
            deal_title=serializer.validated_data.get("title", ""),
            deal_amount=serializer.validated_data.get("amount", 0),
            deal_currency=serializer.validated_data.get("currency") or "KZT",
            use_ai_qualification=False,
        )
        return Response(DealSerializer(result.deal).data, status=status.HTTP_201_CREATED)

    def _source_from_channel(self, channel):
        return source_from_channel(channel)

    def _create_client_from_conversation(self, conversation):
        result = run_conversation_pipeline(conversation=conversation, create_lead=False, create_deal=False, create_task=False, source="api")
        return result.client

    def _default_pipeline_and_stage(self, business):
        return default_pipeline_and_stage(business)

    def _last_message_text(self, conversation):
        return last_message_text(conversation)

    def _last_message_id(self, conversation):
        return conversation.messages.order_by("-created_at").values_list("id", flat=True).first()

    def _qualification_preview_for_execution(self, conversation):
        metadata = conversation.metadata_json or {}
        preview_payload = metadata.get(QUALIFICATION_PREVIEW_META_KEY)
        if not isinstance(preview_payload, dict):
            raise ValidationError({"detail": "Run AI qualification preview before CRM pipeline execution."})
        qualification_payload = preview_payload.get("qualification")
        if not isinstance(qualification_payload, dict):
            raise ValidationError({"detail": "Run AI qualification preview before CRM pipeline execution."})
        preview_last_message_id = preview_payload.get("last_message_id")
        current_last_message_id = self._last_message_id(conversation)
        if preview_last_message_id != current_last_message_id:
            raise ValidationError({"detail": "AI qualification preview is stale. Run preview again before CRM pipeline execution."})
        return preview_payload
