from rest_framework import serializers

from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.clients.models import Client
from apps.leads.models import Lead


class BotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bot
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class BotChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotChannel
        fields = "__all__"
        read_only_fields = ["public_token", "created_at", "updated_at"]


class BotConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotConversation
        fields = "__all__"
        read_only_fields = ["public_id", "created_at", "updated_at"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        bot = attrs.get("bot") or getattr(self.instance, "bot", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)
        lead = attrs.get("lead") or getattr(self.instance, "lead", None)

        if business and bot and bot.business_id != business.id:
            raise serializers.ValidationError("Bot must belong to the selected business.")
        if business and client and client.business_id != business.id:
            raise serializers.ValidationError("Client must belong to the selected business.")
        if business and lead and lead.business_id != business.id:
            raise serializers.ValidationError("Lead must belong to the selected business.")
        return attrs


class BotMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotMessage
        fields = "__all__"
        read_only_fields = ["created_at"]


class PublicWebsiteChatChannelSerializer(serializers.Serializer):
    bot_name = serializers.CharField(source="bot.name")
    channel = serializers.CharField()
    status = serializers.CharField()
    default_language = serializers.CharField(source="bot.default_language")


class PublicWebsiteChatConversationCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    email = serializers.EmailField(required=False, allow_blank=True)
    message = serializers.CharField(required=True, allow_blank=False)
    external_user_id = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def create(self, validated_data):
        channel = self.context["channel"]
        business = channel.bot.business
        full_name = validated_data.get("full_name") or "Website visitor"
        phone = validated_data.get("phone", "")
        email = validated_data.get("email", "")
        message = validated_data["message"]
        client = None
        lead = None

        if phone or email:
            client = self._get_or_create_client(business, full_name, phone, email)
            lead = Lead.objects.create(
                business=business,
                client=client,
                source=Lead.Sources.WEBSITE,
                message=message,
            )

        conversation = BotConversation.objects.create(
            business=business,
            bot=channel.bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id=validated_data.get("external_user_id") or "",
            client=client,
            lead=lead,
        )
        bot_message = BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            text=message,
            payload_json={
                "full_name": full_name,
                "phone": phone,
                "email": email,
                "source": "website_chat",
            },
        )
        return {"conversation": conversation, "message": bot_message, "client": client, "lead": lead}

    def _get_or_create_client(self, business, full_name, phone, email):
        queryset = Client.objects.filter(business=business)
        client = None
        if email:
            client = queryset.filter(email=email).first()
        if client is None and phone:
            client = queryset.filter(phone=phone).first()
        if client:
            update_fields = []
            if full_name and client.full_name == "Website visitor":
                client.full_name = full_name
                update_fields.append("full_name")
            if phone and not client.phone:
                client.phone = phone
                update_fields.append("phone")
            if email and not client.email:
                client.email = email
                update_fields.append("email")
            if update_fields:
                client.save(update_fields=update_fields)
            return client
        return Client.objects.create(
            business=business,
            full_name=full_name,
            phone=phone,
            email=email,
            source=Client.Sources.WEBSITE,
        )


class PublicWebsiteChatMessageCreateSerializer(serializers.Serializer):
    message = serializers.CharField(required=True, allow_blank=False)
    external_user_id = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def create(self, validated_data):
        conversation = self.context["conversation"]
        if validated_data.get("external_user_id") and not conversation.external_user_id:
            conversation.external_user_id = validated_data["external_user_id"]
            conversation.save(update_fields=["external_user_id", "updated_at"])
        return BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            text=validated_data["message"],
            payload_json={"source": "website_chat"},
        )
