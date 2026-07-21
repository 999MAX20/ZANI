from django.conf import settings
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.ai_core.analyst import build_event_analyst_brief
from apps.ai_core.assistant import assert_business_access, build_crm_context
from apps.ai_core.audit import audit_ai_tool_execution, audit_approval_decision, audit_approval_request_created
from apps.ai_core.models import AIJob, AIToolCallLog, AIRequestLog, AgentProfile, BusinessKnowledgeItem
from apps.ai_core.models import ApprovalRequest
from apps.ai_core.recommendations import build_owner_daily_brief
from apps.ai_core.serializers import (
    AIAnalystBriefSerializer,
    AIOwnerDailyBriefSerializer,
    AIAssistantChatSerializer,
    AIAssistantStatusSerializer,
    AIJobSerializer,
    ApprovalRequestSerializer,
    AIToolCallLogSerializer,
    AIToolSuggestSerializer,
    AIRequestLogSerializer,
    AgentProfileSerializer,
    BusinessKnowledgeItemSerializer,
)
from apps.ai_core.services import create_ai_job, run_ai_request
from apps.ai_core.tool_registry import assert_tool_execution_allowed, execute_tool_call_once, registered_tools, suggest_tool_calls, tool_call_fingerprint, tool_requires_approval
from apps.businesses.access import Actions, Resources, assert_can
from apps.core.permissions import user_can_access_business
from apps.core.viewsets import TenantModelViewSet


def _resource_for_approval_action(action_type):
    if action_type == ApprovalRequest.ActionTypes.AI_OUTREACH or action_type == ApprovalRequest.ActionTypes.CAMPAIGN_LAUNCH:
        return Resources.AI_OUTREACH
    if action_type == ApprovalRequest.ActionTypes.AI_PIPELINE:
        return Resources.AI_PIPELINE
    return Resources.AI_AUTOMATION


class AIRequestLogViewSet(TenantModelViewSet):
    queryset = AIRequestLog.objects.select_related("business", "user")
    serializer_class = AIRequestLogSerializer
    access_resource = Resources.AI_ANALYST
    http_method_names = ["get", "head", "options"]


class AIJobViewSet(TenantModelViewSet):
    queryset = AIJob.objects.select_related("business", "user", "request_log")
    serializer_class = AIJobSerializer
    access_resource = Resources.AI_ASSISTANT
    http_method_names = ["get", "head", "options"]


class BusinessKnowledgeItemViewSet(TenantModelViewSet):
    queryset = BusinessKnowledgeItem.objects.select_related("business")
    serializer_class = BusinessKnowledgeItemSerializer
    access_resource = Resources.AI_AUTOMATION


class AgentProfileViewSet(TenantModelViewSet):
    queryset = AgentProfile.objects.select_related("business", "bot")
    serializer_class = AgentProfileSerializer
    access_resource = Resources.AI_AUTOMATION


class ApprovalRequestViewSet(TenantModelViewSet):
    queryset = ApprovalRequest.objects.select_related(
        "business",
        "requested_by",
        "approved_by",
        "rejected_by",
        "ai_request_log",
        "ai_tool_call_log",
    )
    serializer_class = ApprovalRequestSerializer
    access_resource = Resources.AI_AUTOMATION
    action_permission_map = {
        **TenantModelViewSet.action_permission_map,
        "approve": Actions.APPROVE,
        "reject": Actions.APPROVE,
    }

    def perform_create(self, serializer):
        business = serializer.validated_data.get("business")
        action_type = serializer.validated_data.get("action_type")
        resource = _resource_for_approval_action(action_type)
        requested_by = self.request.user if self.request.user.is_authenticated else None
        validated_data = dict(serializer.validated_data)
        tool_log = validated_data.get("ai_tool_call_log")
        if tool_log is not None:
            validated_data["payload"] = {
                **(validated_data.get("payload") or {}),
                "tool_call_id": tool_log.id,
                "tool_fingerprint": tool_call_fingerprint(tool_log),
                "requested_user_id": requested_by.id if requested_by else None,
            }
        candidate = ApprovalRequest(
            **validated_data,
            requested_by=requested_by,
            status=ApprovalRequest.Statuses.PENDING,
        )
        assert_can(self.request.user, business, resource, Actions.SUGGEST, obj=candidate)
        approval = serializer.save(
            payload=validated_data.get("payload") or {},
            requested_by=requested_by,
            status=ApprovalRequest.Statuses.PENDING,
            approved_by=None,
            approved_at=None,
            rejected_by=None,
            rejected_at=None,
        )
        audit_approval_request_created(self.request, approval)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        from django.utils import timezone

        approval = self.get_object()
        assert_can(request.user, approval.business, _resource_for_approval_action(approval.action_type), Actions.APPROVE, obj=approval)
        if approval.status != ApprovalRequest.Statuses.PENDING:
            return Response(ApprovalRequestSerializer(approval).data, status=400)
        approval.status = ApprovalRequest.Statuses.APPROVED
        approval.approved_by = request.user
        approval.approved_at = timezone.now()
        approval.reason = request.data.get("reason", approval.reason)
        approval.save(update_fields=["status", "approved_by", "approved_at", "reason", "updated_at"])
        audit_approval_decision(request, approval, decision="approved")
        return Response(ApprovalRequestSerializer(approval).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        from django.utils import timezone

        approval = self.get_object()
        assert_can(request.user, approval.business, _resource_for_approval_action(approval.action_type), Actions.APPROVE, obj=approval)
        if approval.status != ApprovalRequest.Statuses.PENDING:
            return Response(ApprovalRequestSerializer(approval).data, status=400)
        approval.status = ApprovalRequest.Statuses.REJECTED
        approval.rejected_by = request.user
        approval.rejected_at = timezone.now()
        approval.reason = request.data.get("reason", approval.reason)
        approval.save(update_fields=["status", "rejected_by", "rejected_at", "reason", "updated_at"])
        audit_approval_decision(request, approval, decision="rejected")
        return Response(ApprovalRequestSerializer(approval).data)


class AIAssistantChatView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai_assistant"

    def post(self, request):
        serializer = AIAssistantChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        try:
            assert_business_access(request.user, business)
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc
        assert_can(request.user, business, Resources.AI_ASSISTANT, Actions.SUGGEST)

        crm_context = build_crm_context(business, user=request.user)
        if settings.AI_ENABLED and settings.AI_PROVIDER != "mock" and settings.AI_QUEUE_LIVE_REQUESTS:
            job, created = create_ai_job(
                business=business,
                user=request.user,
                source=AIRequestLog.Sources.CRM,
                prompt_type=serializer.validated_data.get("prompt_type") or "crm_assistant",
                user_input=serializer.validated_data["message"],
                input_json={"crm_context": crm_context},
                idempotency_key=serializer.validated_data.get("idempotency_key"),
            )
            return Response(
                {
                    "job": AIJobSerializer(job).data,
                    "created": created,
                    "context": crm_context["summary"],
                },
                status=202,
            )
        result, log = run_ai_request(
            business=business,
            user=request.user,
            source=AIRequestLog.Sources.CRM,
            prompt_type=serializer.validated_data.get("prompt_type") or "crm_assistant",
            user_input=serializer.validated_data["message"],
            input_json={"crm_context": crm_context},
            allow_mock=True,
        )
        return Response(
            {
                "answer": result.output_text,
                "is_mock": result.is_mock,
                "provider": result.provider,
                "model": result.model,
                "tokens_used": result.tokens_used,
                "log_id": log.id,
                "context": crm_context["summary"],
            }
        )


class AIAssistantStatusView(APIView):
    def get(self, request):
        serializer = AIAssistantStatusSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        try:
            assert_business_access(request.user, business)
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc
        assert_can(request.user, business, Resources.AI_ASSISTANT, Actions.VIEW)

        from django.conf import settings

        provider = settings.AI_PROVIDER
        configured_keys = {
            "kimi": bool(settings.KIMI_API_KEY),
            "openrouter": bool(settings.OPENROUTER_API_KEY),
            "openai": bool(settings.OPENAI_API_KEY),
        }
        key_ready = provider == "mock" or configured_keys.get(provider, False)
        mode = "mock" if provider == "mock" or not key_ready or not settings.AI_ENABLED else "live"
        return Response(
            {
                "enabled": settings.AI_ENABLED,
                "provider": provider,
                "mode": mode,
                "ready": bool(settings.AI_ENABLED and key_ready),
                "key_configured": key_ready,
                "model": settings.AI_SMART_MODEL,
                "fast_model": settings.AI_FAST_MODEL,
                "cheap_model": settings.AI_CHEAP_MODEL,
            }
        )


class AIAnalystBriefView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai_assistant"

    def get(self, request):
        serializer = AIAnalystBriefSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        try:
            assert_business_access(request.user, business)
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc
        assert_can(request.user, business, Resources.AI_ANALYST, Actions.VIEW)

        brief = build_event_analyst_brief(
            business=business,
            user=request.user,
            limit=serializer.validated_data["limit"],
        )
        return Response(brief)


class AIOwnerDailyBriefView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai_assistant"

    def get(self, request):
        serializer = AIOwnerDailyBriefSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        try:
            assert_business_access(request.user, business)
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc
        assert_can(request.user, business, Resources.AI_ANALYST, Actions.VIEW)

        return Response(
            build_owner_daily_brief(
                business=business,
                user=request.user,
                limit=serializer.validated_data["limit"],
            )
        )


class AIToolSuggestView(APIView):
    def post(self, request):
        serializer = AIToolSuggestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        if not user_can_access_business(request.user, business):
            raise PermissionDenied("You do not have access to this business.")
        assert_can(request.user, business, Resources.AI_PIPELINE, Actions.SUGGEST)

        logs = suggest_tool_calls(
            business=business,
            user=request.user,
            conversation=serializer.validated_data.get("conversation"),
            message=serializer.validated_data.get("message", ""),
        )
        return Response(
            {
                "tools": [
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "requires_confirmation": tool.requires_confirmation,
                    }
                    for tool in registered_tools()
                ],
                "suggested_actions": AIToolCallLogSerializer(logs, many=True).data,
            },
            status=201,
        )


class AIToolExecuteView(APIView):
    def post(self, request, log_id):
        log = AIToolCallLog.objects.select_related("business", "conversation").filter(id=log_id).first()
        if log is None:
            raise PermissionDenied("Tool call was not found.")
        if not user_can_access_business(request.user, log.business):
            raise PermissionDenied("You do not have access to this business.")
        assert_can(request.user, log.business, Resources.AI_PIPELINE, Actions.EXECUTE, obj=log)
        if log.status not in {AIToolCallLog.Statuses.SUGGESTED, AIToolCallLog.Statuses.EXECUTED}:
            log.status = AIToolCallLog.Statuses.REJECTED
            log.error = "Only suggested or already executed tool calls can be submitted."
            log.locked_at = None
            log.save(update_fields=["status", "error", "locked_at"])
            audit_ai_tool_execution(request, log)
            return Response(AIToolCallLogSerializer(log).data, status=400)
        approval = None
        if tool_requires_approval(log.tool_name):
            approval, error_response = self._resolve_required_approval(request, log)
            if error_response is not None:
                return error_response

        try:
            assert_tool_execution_allowed(log, request.user)
        except PermissionDenied as exc:
            audit_ai_tool_execution(
                request,
                log,
                status="permission_denied",
                error=str(exc),
                extra_metadata={
                    "approval_id": approval.id if approval else None,
                    "approval_required": bool(approval),
                },
            )
            return Response(
                {
                    "detail": str(exc),
                    "approval_required": bool(approval),
                    "approval_status": "permission_denied",
                    "tool_call": AIToolCallLogSerializer(log).data,
                },
                status=403,
            )
        log, duplicate = execute_tool_call_once(log.id, request.user)
        if approval and log.status == AIToolCallLog.Statuses.EXECUTED:
            approval.status = ApprovalRequest.Statuses.EXECUTED
            approval.save(update_fields=["status", "updated_at"])
        audit_ai_tool_execution(
            request,
            log,
            extra_metadata={
                "approval_id": approval.id if approval else None,
                "approval_required": bool(approval),
                "duplicate_execution": duplicate,
            },
        )
        status_code = 200 if log.status == AIToolCallLog.Statuses.EXECUTED else 400
        return Response(AIToolCallLogSerializer(log).data, status=status_code)

    def _resolve_required_approval(self, request, log):
        from django.utils import timezone

        approval_id = request.data.get("approval_id") or request.data.get("approval")
        if not approval_id:
            return None, self._approval_error(request, log, "Approval is required for this AI tool.", "approval_required")
        approval = (
            ApprovalRequest.objects.select_related("business", "ai_tool_call_log")
            .filter(id=approval_id)
            .first()
        )
        if approval is None:
            return None, self._approval_error(request, log, "Approval request was not found.", "approval_not_found")
        if approval.business_id != log.business_id or approval.ai_tool_call_log_id != log.id:
            return None, self._approval_error(
                request,
                log,
                "Approval request does not match this AI tool call.",
                "approval_mismatch",
                approval=approval,
            )
        if approval.action_type != ApprovalRequest.ActionTypes.AI_PIPELINE:
            return None, self._approval_error(request, log, "Approval action type is invalid.", "approval_invalid", approval=approval)
        if approval.expires_at and approval.expires_at <= timezone.now():
            approval.status = ApprovalRequest.Statuses.EXPIRED
            approval.save(update_fields=["status", "updated_at"])
            return None, self._approval_error(request, log, "Approval request has expired.", "approval_expired", approval=approval)
        if approval.requested_by_id and approval.requested_by_id != request.user.id:
            return None, self._approval_error(request, log, "Approval belongs to another requester.", "approval_user_mismatch", approval=approval)
        expected_fingerprint = approval.payload.get("tool_fingerprint") if isinstance(approval.payload, dict) else None
        if expected_fingerprint and expected_fingerprint != tool_call_fingerprint(log):
            return None, self._approval_error(request, log, "AI tool arguments changed after approval.", "approval_payload_mismatch", approval=approval)
        if approval.status not in {ApprovalRequest.Statuses.APPROVED, ApprovalRequest.Statuses.EXECUTED}:
            return None, self._approval_error(request, log, "Approval request must be approved before execution.", "approval_not_approved", approval=approval)
        return approval, None

    def _approval_error(self, request, log, detail, status, *, approval=None):
        audit_ai_tool_execution(
            request,
            log,
            status=status,
            error=detail,
            extra_metadata={
                "approval_required": True,
                "approval_id": approval.id if approval else None,
            },
        )
        return Response(
            {
                "detail": detail,
                "approval_required": True,
                "approval_status": status,
                "tool_call": AIToolCallLogSerializer(log).data,
            },
            status=403,
        )
