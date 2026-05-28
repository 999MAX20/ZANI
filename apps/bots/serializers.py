from rest_framework import serializers

from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.bots.inbox_service import register_bot_message
from apps.billing.models import UsageCounter
from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows
from apps.billing.usage import increment_usage
from apps.clients.models import Client
from apps.conversations.auto_pipeline import maybe_run_auto_pipeline
from apps.outreach.consent import payload_has_explicit_consent
from apps.outreach.models import OutreachCampaign
from apps.outreach.services import record_explicit_consent
from apps.integrations.sanitization import sanitize_config
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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["config_json"] = sanitize_config(data.get("config_json") or {})
        return data


class TelegramChannelConfigSerializer(serializers.Serializer):
    bot_token = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    webhook_secret = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)


class TelegramSetWebhookSerializer(serializers.Serializer):
    webhook_url = serializers.URLField(required=True)


class WhatsAppChannelConfigSerializer(serializers.Serializer):
    provider_mode = serializers.ChoiceField(choices=["mock", "meta_cloud", "disabled"], required=False)
    webhook_secret = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    phone_number_id = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    access_token = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    business_account_id = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    display_phone_number = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)


class InstagramChannelConfigSerializer(serializers.Serializer):
    provider_mode = serializers.ChoiceField(choices=["mock", "meta_graph", "disabled"], required=False)
    instagram_user_id = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    access_token = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    page_id = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    username = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)


class BotConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotConversation
        fields = "__all__"
        read_only_fields = ["public_id", "created_at", "updated_at", "archived_at", "archived_by"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        bot = attrs.get("bot") or getattr(self.instance, "bot", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)
        lead = attrs.get("lead") or getattr(self.instance, "lead", None)
        assigned_to = attrs.get("assigned_to") or getattr(self.instance, "assigned_to", None)

        if business and bot and bot.business_id != business.id:
            raise serializers.ValidationError("Bot must belong to the selected business.")
        if business and client and client.business_id != business.id:
            raise serializers.ValidationError("Client must belong to the selected business.")
        if business and lead and lead.business_id != business.id:
            raise serializers.ValidationError("Lead must belong to the selected business.")
        if business and assigned_to and not business.members.filter(user=assigned_to, is_active=True).exists():
            raise serializers.ValidationError("Assigned user must be an active member of the selected business.")
        return attrs

    def create(self, validated_data):
        business = validated_data["business"]
        assert_entitlement_allows(business, EntitlementMetrics.CONVERSATIONS)
        conversation = super().create(validated_data)
        increment_usage(conversation.business, UsageCounter.Metrics.CONVERSATIONS)
        return conversation


class BotMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotMessage
        fields = "__all__"
        read_only_fields = ["created_at"]

    def create(self, validated_data):
        message = super().create(validated_data)
        register_bot_message(message)
        return message


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
    marketing_consent = serializers.BooleanField(required=False, default=False)
    outreach_consent = serializers.BooleanField(required=False, default=False)
    newsletter_consent = serializers.BooleanField(required=False, default=False)
    whatsapp_consent = serializers.BooleanField(required=False, default=False)

    def create(self, validated_data):
        channel = self.context["channel"]
        business = channel.bot.business
        assert_entitlement_allows(business, EntitlementMetrics.CONVERSATIONS)
        full_name = validated_data.get("full_name") or "Website visitor"
        phone = validated_data.get("phone", "")
        email = validated_data.get("email", "")
        message = validated_data["message"]
        client = None
        lead = None

        if phone or email:
            client = self._get_or_create_client(business, full_name, phone, email)
            if phone and payload_has_explicit_consent(validated_data, channel=OutreachCampaign.Channels.WHATSAPP):
                record_explicit_consent(
                    client=client,
                    channel=OutreachCampaign.Channels.WHATSAPP,
                    source="website_chat",
                    note="Explicit website chat consent.",
                    evidence={"fields": {key: validated_data.get(key) for key in ["marketing_consent", "outreach_consent", "newsletter_consent", "whatsapp_consent"]}},
                )
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
        increment_usage(business, UsageCounter.Metrics.CONVERSATIONS)
        bot_message = BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text=message,
            payload_json={
                "full_name": full_name,
                "phone": phone,
                "email": email,
                "source": "website_chat",
            },
        )
        register_bot_message(bot_message)
        maybe_run_auto_pipeline(conversation=conversation, message=bot_message, channel=channel)
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
        assert_entitlement_allows(conversation.business, EntitlementMetrics.BOT_MESSAGES)
        if validated_data.get("external_user_id") and not conversation.external_user_id:
            conversation.external_user_id = validated_data["external_user_id"]
            conversation.save(update_fields=["external_user_id", "updated_at"])
        bot_message = BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text=validated_data["message"],
            payload_json={"source": "website_chat"},
        )
        register_bot_message(bot_message)
        channel = BotChannel.objects.filter(bot=conversation.bot, channel=BotChannel.Channels.WEBSITE).first()
        maybe_run_auto_pipeline(conversation=conversation, message=bot_message, channel=channel)
        return bot_message
