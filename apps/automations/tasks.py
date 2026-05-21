from celery import shared_task

from apps.automations.engine import process_automation_run, process_due_automation_runs


@shared_task(bind=True, name="automations.process_automation_run", queue="automations")
def process_automation_run_task(self, run_id):
    run = process_automation_run(run_id)
    return {"run_id": run.id, "status": run.status} if run else {"run_id": run_id, "status": "missing"}


@shared_task(bind=True, name="automations.process_due_automation_runs", queue="automations")
def process_due_automation_runs_task(self, limit=100):
    runs = process_due_automation_runs(limit=limit)
    return {"processed": len(runs), "run_ids": [run.id for run in runs if run is not None]}
