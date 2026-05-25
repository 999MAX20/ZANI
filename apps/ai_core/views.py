from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.ai_core.assistant import assert_business_access, build_crm_context
from apps.ai_core.models import AIToolCallLog, AIRequestLog, AgentProfile, BusinessKnowledgeItem
from apps.ai_core.serializers import (
    AIAssistantChatSerializer,
    AIAssistantStatusSerializer,
    AIToolCallLogSerializer,
    AIToolSuggestSerializer,
    AIRequestLogSerializer,
    AgentProfileSerializer,
    BusinessKnowledgeItemSerializer,
)
from apps.ai_core.services import run_ai_request
from apps.ai_core.tool_registry import execute_tool_call, registered_tools, suggest_tool_calls
from apps.core.permissions import user_can_access_business
from apps.core.viewsets import TenantModelViewSet


class AIRequestLogViewSet(TenantModelViewSet):
    queryset = AIRequestLog.objects.select_related("business", "user")
    serializer_class = AIRequestLogSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user if self.request.user.is_authenticated else None)


class BusinessKnowledgeItemViewSet(TenantModelViewSet):
    queryset = BusinessKnowledgeItem.objects.select_related("business")
    serializer_class = BusinessKnowledgeItemSerializer


class AgentProfileViewSet(TenantModelViewSet):
    queryset = AgentProfile.objects.select_related("business", "bot")
    serializer_class = AgentProfileSerializer


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

        crm_context = build_crm_context(business)
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


class AIToolSuggestView(APIView):
    def post(self, request):
        serializer = AIToolSuggestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = serializer.validated_data["business"]
        if not user_can_access_business(request.user, business):
            raise PermissionDenied("You do not have access to this business.")

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
        if log.status != AIToolCallLog.Statuses.SUGGESTED:
            log.status = AIToolCallLog.Statuses.REJECTED
            log.error = "Only suggested tool calls can be executed."
            log.save(update_fields=["status", "error"])
            return Response(AIToolCallLogSerializer(log).data, status=400)

        log = execute_tool_call(log, request.user)
        status_code = 200 if log.status == AIToolCallLog.Statuses.EXECUTED else 400
        return Response(AIToolCallLogSerializer(log).data, status=status_code)
