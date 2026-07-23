from django.contrib.auth import get_user_model
from django.db.models import OuterRef, Subquery
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
from apps.businesses.capabilities import resource_is_enabled
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
from apps.conversations.inbox_helpers import (
    QUALIFICATION_PREVIEW_META_KEY,
    apply_inbox_filters,
    build_inbox_summary_payload,
    build_message_page,
    last_message_id,
    qualification_preview_for_execution,
)
from apps.conversations.pipeline import run_conversation_pipeline, source_from_channel
from apps.conversations.services import create_task_from_conversation
from apps.core.permissions import accessible_businesses
from apps.core.idempotency import CRMCommandResult, run_idempotent_crm_command
from apps.crm.models import Deal
from apps.crm.serializers import DealSerializer
from apps.leads.models import Lead
from apps.leads.serializers import LeadSerializer
from apps.scheduling.serializers import AppointmentSerializer
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer


class IsMerchantInboxUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "is_merchant_user", False))


class InboxConversationViewSet(ReadOnlyModelViewSet):
    DEFAULT_MESSAGE_PAGE_SIZE = 200
    MAX_MESSAGE_PAGE_SIZE = 300

    serializer_class = InboxConversationSerializer
    permission_classes = [IsMerchantInboxUser]

    def get_queryset(self):
        latest_message = BotMessage.objects.filter(conversation_id=OuterRef("pk")).order_by("-created_at", "-id")
        queryset = BotConversation.objects.select_related(
            "business",
            "bot",
            "client",
            "lead",
            "deal",
            "assigned_to",
        ).annotate(
            latest_message_id=Subquery(latest_message.values("id")[:1]),
            latest_message_direction=Subquery(latest_message.values("direction")[:1]),
            latest_message_sender_type=Subquery(latest_message.values("sender_type")[:1]),
            latest_message_text=Subquery(latest_message.values("text")[:1]),
            latest_message_status=Subquery(latest_message.values("status")[:1]),
            latest_message_created_at=Subquery(latest_message.values("created_at")[:1]),
        )
        businesses = list(accessible_businesses(self.request.user))
        filtered = queryset.filter(business__in=businesses)
        scoped_queryset = queryset.none()
        for business in businesses:
            if not resource_is_enabled(business, Resources.CONVERSATIONS):
                continue
            if not can(self.request.user, business, Resources.CONVERSATIONS, Actions.VIEW).allowed:
                continue
            scoped_queryset = scoped_queryset | scope_queryset(
                filtered.filter(business=business),
                self.request.user,
                business,
                Resources.CONVERSATIONS,
                Actions.VIEW,
            )
        return apply_inbox_filters(scoped_queryset.distinct(), self.request.query_params, self.request.user)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Return owner/manager friendly inbox health for the mobile dashboard.

        This endpoint intentionally does not promise full production omnichannel.
        It summarizes the channels already flowing through the inbox and shows
        WhatsApp/Instagram as pilot roadmap channels when they are not connected yet.
        """
        return Response(build_inbox_summary_payload(self.get_queryset(), request.user))

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
                idempotency_key=request.headers.get("Idempotency-Key", ""),
            )
            return Response(InboxMessageSerializer(message).data, status=status.HTTP_201_CREATED)

        page = build_message_page(
            conversation,
            request.query_params,
            default_limit=self.DEFAULT_MESSAGE_PAGE_SIZE,
            max_limit=self.MAX_MESSAGE_PAGE_SIZE,
        )
        serializer = InboxMessageSerializer(page["messages"], many=True)
        return Response({
            "count": page["count"],
            "next": page["next"],
            "previous": None,
            "results": serializer.data,
            "next_before_id": page["next_before_id"],
            "has_more": page["has_more"],
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
        from apps.bots.outbound_delivery import retry_outbound_message

        retried, retry_requested = retry_outbound_message(
            original,
            actor=request.user,
            idempotency_key=request.headers.get("Idempotency-Key", ""),
        )
        if retry_requested:
            record_message_retry(conversation, original_message=original, retried_message=retried, actor=request.user)
        return Response(InboxMessageSerializer(retried).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        conversation = BotConversation.objects.select_related("business", "assigned_to").filter(
            id=pk,
            business__in=accessible_businesses(request.user),
        ).first()
        if conversation is None:
            raise PermissionDenied("Conversation was not found.")
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
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

        def operation():
            task = create_task_from_conversation(
                conversation=conversation,
                actor=request.user,
                title=serializer.validated_data.get("title", ""),
                description=serializer.validated_data.get("description", ""),
                priority=serializer.validated_data.get("priority", Task.Priorities.NORMAL),
                due_at=serializer.validated_data.get("due_at"),
            )
            return CRMCommandResult(
                data=TaskSerializer(task).data,
                status_code=status.HTTP_201_CREATED,
                resource=task,
            )

        command = run_idempotent_crm_command(
            business=conversation.business,
            actor=request.user,
            action="conversation.create_task",
            idempotency_key=request.headers.get("Idempotency-Key", ""),
            payload={"conversation_id": conversation.id, **serializer.validated_data},
            operation=operation,
        )
        return Response(command.data, status=command.status_code)

    @action(detail=True, methods=["post"], url_path="create-appointment")
    def create_appointment(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.APPOINTMENTS, Actions.CREATE)
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxCreateAppointmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        def operation():
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
            return CRMCommandResult(
                data=AppointmentSerializer(appointment).data,
                status_code=status.HTTP_201_CREATED,
                resource=appointment,
            )

        command = run_idempotent_crm_command(
            business=conversation.business,
            actor=request.user,
            action="conversation.create_appointment",
            idempotency_key=request.headers.get("Idempotency-Key", ""),
            payload={"conversation_id": conversation.id, **serializer.validated_data},
            operation=operation,
        )
        return Response(command.data, status=command.status_code)

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
            "last_message_id": last_message_id(conversation),
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
            preview_payload = qualification_preview_for_execution(conversation)
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
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxLinkLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lead = Lead.objects.filter(id=serializer.validated_data["lead_id"], business=conversation.business).first()
        if lead is None:
            raise ValidationError({"lead_id": "Lead was not found in this business."})
        assert_can(request.user, conversation.business, Resources.LEADS, Actions.VIEW, obj=lead)
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
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxLinkClientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        client = Client.objects.filter(id=serializer.validated_data["client_id"], business=conversation.business).first()
        if client is None:
            raise ValidationError({"client_id": "Client was not found in this business."})
        assert_can(request.user, conversation.business, Resources.CLIENTS, Actions.VIEW, obj=client)
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
            source=source_from_channel(conversation.channel),
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
        assert_can(request.user, conversation.business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        serializer = InboxLinkDealSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        deal = Deal.objects.filter(id=serializer.validated_data["deal_id"], business=conversation.business).first()
        if deal is None:
            raise ValidationError({"deal_id": "Deal was not found in this business."})
        assert_can(request.user, conversation.business, Resources.DEALS, Actions.VIEW, obj=deal)
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
