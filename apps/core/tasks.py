from celery import shared_task

from apps.core.export_jobs import process_due_export_jobs, process_export_job


@shared_task(bind=True, name="exports.process_job", queue="reports_exports")
def process_export_job_task(self, job_id):
    job = process_export_job(job_id)
    return {"job_id": job_id, "status": job.status if job else "missing"}


@shared_task(bind=True, name="exports.process_due_jobs", queue="reports_exports")
def process_due_export_jobs_task(self, limit=50):
    jobs = process_due_export_jobs(limit=limit)
    return {"processed": len(jobs), "job_ids": [job.id for job in jobs if job is not None]}
