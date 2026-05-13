from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai_core.assistant import assert_business_access, build_crm_context
from apps.ai_core.models import AIRequestLog, BusinessKnowledgeItem
from apps.ai_core.serializers import AIRequestLogSerializer, BusinessKnowledgeItemSerializer, AIAssistantChatSerializer
from apps.ai_core.services import run_ai_request
from apps.core.viewsets import TenantModelViewSet


class AIRequestLogViewSet(TenantModelViewSet):
    queryset = AIRequestLog.objects.select_related("business", "user")
    serializer_class = AIRequestLogSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user if self.request.user.is_authenticated else None)


class BusinessKnowledgeItemViewSet(TenantModelViewSet):
    queryset = BusinessKnowledgeItem.objects.select_related("business")
    serializer_class = BusinessKnowledgeItemSerializer


class AIAssistantChatView(APIView):
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
                "model": result.model,
                "tokens_used": result.tokens_used,
                "log_id": log.id,
                "context": crm_context["summary"],
            }
        )
