from celery import shared_task

from apps.ai_core.services import process_ai_job, process_due_ai_jobs


@shared_task(bind=True, name="ai.process_job", queue="ai")
def process_ai_job_task(self, job_id):
    job = process_ai_job(job_id)
    return {"job_id": job_id, "status": job.status if job else "missing"}


@shared_task(bind=True, name="ai.process_due_jobs", queue="ai")
def process_due_ai_jobs_task(self, limit=100):
    jobs = process_due_ai_jobs(limit=limit)
    return {"processed": len(jobs), "job_ids": [job.id for job in jobs if job is not None]}
