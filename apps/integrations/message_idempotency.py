from django.db import IntegrityError, transaction

from apps.bots.models import BotMessage


def find_existing_inbound_message(conversation, external_message_id):
    if not external_message_id:
        return None
    return BotMessage.objects.filter(
        conversation=conversation,
        direction=BotMessage.Directions.INBOUND,
        external_message_id=external_message_id,
    ).first()


def create_inbound_message_once(conversation, *, text, external_message_id, payload_json, status=BotMessage.Statuses.RECEIVED):
    existing_message = find_existing_inbound_message(conversation, external_message_id)
    if existing_message:
        return existing_message, False

    try:
        with transaction.atomic():
            return (
                BotMessage.objects.create(
                    conversation=conversation,
                    direction=BotMessage.Directions.INBOUND,
                    sender_type=BotMessage.SenderTypes.CLIENT,
                    text=text,
                    external_message_id=external_message_id,
                    payload_json=payload_json,
                    status=status,
                ),
                True,
            )
    except IntegrityError:
        existing_message = find_existing_inbound_message(conversation, external_message_id)
        if existing_message:
            return existing_message, False
        raise
