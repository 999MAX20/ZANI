from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.integrations.telegram import save_telegram_inbound_message, verify_telegram_secret


class TelegramWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        provided_secret = verify_telegram_secret(request)
        conversation, message = save_telegram_inbound_message(request.data, provided_secret)
        return Response(
            {
                "ok": True,
                "conversation_id": conversation.id,
                "message_id": message.id,
            },
            status=200,
        )
