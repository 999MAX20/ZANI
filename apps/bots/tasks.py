from celery import shared_task

from apps.bots.outbound_delivery import deliver_outbound_message, process_due_outbound_messages


@shared_task(bind=True, name="bots.process_outbound_message", queue="integrations")
def process_outbound_message_task(self, message_id):
    message = deliver_outbound_message(message_id)
    return {
        "message_id": message_id,
        "status": message.status if message else "missing",
    }


@shared_task(bind=True, name="bots.process_due_outbound_messages", queue="integrations")
def process_due_outbound_messages_task(self, limit=100):
    messages = process_due_outbound_messages(limit=limit)
    return {
        "processed": len(messages),
        "message_ids": [message.id for message in messages if message is not None],
    }
