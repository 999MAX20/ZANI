from django.db import transaction

from apps.bots.models import Bot, BotChannel
from apps.businesses.models import Business
from apps.core.domain_errors import InvalidTransition, OwnershipConflict
from apps.integrations.models import BusinessConnector
from apps.integrations.channel_boundary import lock_channel_for_setup, validate_channel_public_write


READINESS_PROFILE = "profile"
READINESS_CHANNEL = "channel"
READINESS_KNOWLEDGE = "knowledge"


def get_bot_readiness(bot: Bot) -> dict:
    profiles = list(bot.agent_profiles.all())
    channels = list(bot.channels.all())
    knowledge_items = list(bot.business.knowledge_items.all())

    profile_ready = any(profile.is_active for profile in profiles)
    channel_ready = any(channel.status == BotChannel.Statuses.ACTIVE for channel in channels)
    knowledge_ready = any(item.is_active for item in knowledge_items)
    missing = [
        key
        for key, ready in (
            (READINESS_PROFILE, profile_ready),
            (READINESS_CHANNEL, channel_ready),
            (READINESS_KNOWLEDGE, knowledge_ready),
        )
        if not ready
    ]
    return {
        "is_ready": not missing,
        "profile_ready": profile_ready,
        "channel_ready": channel_ready,
        "knowledge_ready": knowledge_ready,
        "missing": missing,
    }


def is_bot_runtime_ready(bot: Bot) -> bool:
    return bot.status == Bot.Statuses.ACTIVE and get_bot_readiness(bot)["is_ready"]


def assert_bot_can_activate(bot: Bot) -> dict:
    readiness = get_bot_readiness(bot)
    if not readiness["is_ready"]:
        raise InvalidTransition(
            detail="The AI agent is not ready to be activated.",
            errors={"readiness": readiness},
        )
    return readiness


@transaction.atomic
def create_bot(*, validated_data: dict) -> Bot:
    requested_status = validated_data.get("status", Bot.Statuses.DRAFT)
    if requested_status == Bot.Statuses.ACTIVE:
        raise InvalidTransition(
            detail="Create the AI agent as a draft and complete its launch requirements before activation.",
            errors={
                "readiness": {
                    "is_ready": False,
                    "profile_ready": False,
                    "channel_ready": False,
                    "knowledge_ready": False,
                    "missing": [READINESS_PROFILE, READINESS_CHANNEL, READINESS_KNOWLEDGE],
                }
            },
        )
    return Bot.objects.create(**validated_data)


@transaction.atomic
def update_bot(*, bot: Bot, validated_data: dict) -> Bot:
    if "status" in validated_data:
        raise InvalidTransition(detail="Use the activate or pause action to change AI agent status.")

    update_fields = []
    for field, value in validated_data.items():
        setattr(bot, field, value)
        update_fields.append(field)
    if update_fields:
        bot.save(update_fields=[*update_fields, "updated_at"])
    return bot


@transaction.atomic
def activate_bot(*, bot: Bot) -> tuple[Bot, bool]:
    if bot.status == Bot.Statuses.ACTIVE:
        return bot, False
    assert_bot_can_activate(bot)
    bot.status = Bot.Statuses.ACTIVE
    bot.save(update_fields=["status", "updated_at"])
    return bot, True


@transaction.atomic
def pause_bot(*, bot: Bot) -> tuple[Bot, bool]:
    if bot.status == Bot.Statuses.PAUSED:
        return bot, False
    if bot.status != Bot.Statuses.ACTIVE:
        raise InvalidTransition(detail="Only an active AI agent can be paused.")
    bot.status = Bot.Statuses.PAUSED
    bot.save(update_fields=["status", "updated_at"])
    return bot, True


@transaction.atomic
def ensure_bot_channel(*, bot: Bot, channel_type: str) -> tuple[BotChannel, bool]:
    Business.objects.select_for_update().get(pk=bot.business_id)
    existing = BotChannel.objects.filter(bot=bot, channel=channel_type).first()
    if existing:
        return existing, False

    if channel_type in {
        BotChannel.Channels.TELEGRAM,
        BotChannel.Channels.WHATSAPP,
        BotChannel.Channels.INSTAGRAM,
    }:
        owner = BotChannel.objects.select_related("bot").filter(
            bot__business_id=bot.business_id,
            channel=channel_type,
        ).first()
        if owner:
            raise OwnershipConflict(
                detail="This messenger channel is already assigned to another AI agent.",
                errors={"channel": channel_type, "bot_id": owner.bot_id},
            )

    config = {}
    if channel_type == BotChannel.Channels.WHATSAPP:
        config = {"provider_mode": "meta_cloud"}
    elif channel_type == BotChannel.Channels.INSTAGRAM:
        config = {"provider_mode": "meta_graph"}
    return BotChannel.objects.create(
        bot=bot,
        channel=channel_type,
        status=BotChannel.Statuses.DRAFT,
        external_id="",
        config_json=config,
    ), True


def assert_channel_can_activate(channel: BotChannel) -> None:
    if channel.channel == BotChannel.Channels.WEBSITE:
        return
    if channel.channel == BotChannel.Channels.TELEGRAM:
        from apps.integrations.bot_channel_credentials import get_telegram_bot_token, get_telegram_webhook_secret

        config = channel.config_json or {}
        if config.get("token_verified") is True and config.get("webhook_configured") is True and get_telegram_bot_token(channel) and get_telegram_webhook_secret(channel):
            return
    else:
        connector = BusinessConnector.objects.filter(
            business=channel.bot.business,
            provider=channel.channel,
            status=BusinessConnector.Statuses.CONNECTED,
            config_json__bot_channel_id=channel.id,
        ).first()
        if connector and (channel.config_json or {}).get("connection_verified") is True:
            return
    raise InvalidTransition(
        detail="Validate the provider connection before enabling this channel.",
        errors={"channel": channel.channel, "status": channel.status},
    )


@transaction.atomic
def update_bot_channel(*, channel: BotChannel, validated_data: dict) -> BotChannel:
    channel = lock_channel_for_setup(channel)
    validated_data = validate_channel_public_write(dict(validated_data), channel)
    requested_status = validated_data.get("status", channel.status)
    if requested_status == BotChannel.Statuses.ACTIVE and channel.status != BotChannel.Statuses.ACTIVE:
        assert_channel_can_activate(channel)
    update_fields = []
    for field, value in validated_data.items():
        setattr(channel, field, value)
        update_fields.append(field)
    if update_fields:
        channel.save(update_fields=[*update_fields, "updated_at"])
    return channel


@transaction.atomic
def create_bot_channel(*, validated_data: dict) -> BotChannel:
    data = validate_channel_public_write(dict(validated_data))
    bot = data["bot"]
    if data.get("status") == BotChannel.Statuses.ACTIVE:
        raise InvalidTransition(detail="Create the channel as a draft and validate it before activation.")
    # Recheck under the same Business lock used by ensure/OAuth; serializers
    # may both have validated before either concurrent request saves.
    channel, created = ensure_bot_channel(bot=bot, channel_type=data["channel"])
    if not created:
        raise OwnershipConflict(detail="This channel already exists. Configure the existing channel.")
    for field, value in data.items():
        setattr(channel, field, value)
    channel.save(update_fields=[*data, "updated_at"])
    return channel
