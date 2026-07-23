from celery import shared_task

from apps.businesses.routing import run_routing_cycle


@shared_task(bind=True, name="routing.process_cycle", queue="automations")
def process_routing_cycle_task(self, routing_limit=100, sla_limit=200):
    return run_routing_cycle(routing_limit=routing_limit, sla_limit=sla_limit)
