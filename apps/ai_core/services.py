import uuid

from django.db.models import F, Q
from django.utils import timezone

from apps.ai_core.ai_client import generate_text
from apps.ai_core.context_service import get_business_knowledge_context
from apps.ai_core.models import AIJob, AIRequestLog
from apps.ai_core.prompt_service import build_prompt
from apps.billing.models import UsageCounter
from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows
from apps.billing.usage import increment_usage
from apps.integrations.sanitization import sanitize_error_text


def run_ai_request(
    *,
    business,
    prompt_type,
    user_input,
    source=AIRequestLog.Sources.CRM,
    user=None,
    input_json=None,
    allow_mock=True,
    model=None,
    model_tier=None,
    temperature=None,
):
    assert_entitlement_allows(business, EntitlementMetrics.AI_REQUESTS)
    context = get_business_knowledge_context(business)
    prompt = build_prompt(prompt_type=prompt_type, user_input=user_input, context=context, runtime_context=input_json)
    result = generate_text(
        prompt,
        prompt_type=prompt_type,
        model=model,
        model_tier=model_tier,
        temperature=temperature,
        allow_mock=allow_mock,
    )
    log = AIRequestLog.objects.create(
        business=business,
        user=user,
        source=source,
        prompt_type=prompt_type,
        input_json={
            "user_input": user_input,
            "context": context,
            "ai_provider": result.provider,
            "ai_model_tier": model_tier,
            "ai_temperature": temperature,
            **(input_json or {}),
        },
        output_text=result.output_text,
        model=result.model,
        tokens_used=result.tokens_used,
    )
    increment_usage(business, UsageCounter.Metrics.AI_REQUESTS)
    return result, log


def create_ai_job(
    *,
    business,
    user,
    prompt_type,
    user_input,
    source=AIRequestLog.Sources.CRM,
    input_json=None,
    idempotency_key=None,
):
    key = idempotency_key or uuid.uuid4().hex
    job, created = AIJob.objects.get_or_create(
        business=business,
        idempotency_key=key,
        defaults={
            "user": user,
            "source": source,
            "prompt_type": prompt_type,
            "input_json": {"user_input": user_input, "runtime_context": input_json or {}},
        },
    )
    if created:
        from apps.ai_core.tasks import process_ai_job_task

        process_ai_job_task.apply_async(args=[job.id], queue="ai")
    return job, created


def process_due_ai_jobs(*, limit=100):
    now = timezone.now()
    job_ids = list(
        AIJob.objects.filter(
            Q(status=AIJob.Statuses.PENDING)
            | Q(status=AIJob.Statuses.RETRY_SCHEDULED, next_retry_at__lte=now)
        )
        .order_by("created_at")
        .values_list("id", flat=True)[:limit]
    )
    return [process_ai_job(job_id) for job_id in job_ids]


def process_ai_job(job_id):
    now = timezone.now()
    claimed = (
        AIJob.objects.filter(id=job_id)
        .filter(
            Q(status=AIJob.Statuses.PENDING)
            | Q(status=AIJob.Statuses.RETRY_SCHEDULED, next_retry_at__lte=now)
        )
        .update(
            status=AIJob.Statuses.RUNNING,
            attempts=F("attempts") + 1,
            locked_at=now,
            next_retry_at=None,
            error="",
            updated_at=now,
        )
    )
    if not claimed:
        return AIJob.objects.filter(id=job_id).first()
    job = AIJob.objects.select_related("business", "user").get(id=job_id)
    try:
        result, log = run_ai_request(
            business=job.business,
            user=job.user,
            source=job.source,
            prompt_type=job.prompt_type,
            user_input=job.input_json.get("user_input", ""),
            input_json=job.input_json.get("runtime_context") or {},
            allow_mock=False,
        )
        job.status = AIJob.Statuses.SUCCEEDED
        job.result_json = {
            "answer": result.output_text,
            "provider": result.provider,
            "model": result.model,
            "tokens_used": result.tokens_used,
            "log_id": log.id,
        }
        job.request_log = log
        job.completed_at = timezone.now()
        job.locked_at = None
        job.save(
            update_fields=["status", "result_json", "request_log", "completed_at", "locked_at", "updated_at"]
        )
    except Exception as exc:
        job.error = sanitize_error_text(exc)
        job.locked_at = None
        if job.attempts < job.max_attempts:
            job.status = AIJob.Statuses.RETRY_SCHEDULED
            delay_seconds = min(3600, 60 * (2 ** max(job.attempts - 1, 0)))
            job.next_retry_at = timezone.now() + timezone.timedelta(seconds=delay_seconds)
        else:
            job.status = AIJob.Statuses.FAILED
            job.completed_at = timezone.now()
        job.save(
            update_fields=["status", "error", "locked_at", "next_retry_at", "completed_at", "updated_at"]
        )
    return job
