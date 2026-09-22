import logging
import uuid

from django.db.models import F, Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.ai_core.ai_client import generate_text
from apps.ai_core.context_service import get_business_knowledge_context
from apps.ai_core.models import AIJob, AIRequestLog
from apps.ai_core.prompt_service import build_prompt
from apps.ai_core.grounding import ANSWER_CONTRACT, source_catalog, validate_answer
from apps.ai_core.assistant import assert_business_access, build_crm_context
from apps.businesses.access import Actions, Resources, assert_can
from apps.billing.models import UsageCounter
from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows
from apps.billing.usage import increment_usage


logger = logging.getLogger(__name__)


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
    runtime_context = dict(input_json or {})
    inbound = [item.get("text", "") for item in runtime_context.get("messages", []) if isinstance(item, dict) and item.get("direction") == "inbound"]
    context = get_business_knowledge_context(business, query=inbound[-1] if inbound else user_input)
    grounded = source == AIRequestLog.Sources.CRM and "crm_context" in runtime_context
    sources = source_catalog(runtime_context.get("crm_context"), context) if grounded else []
    if grounded:
        runtime_context["source_catalog"] = sources
    prompt = build_prompt(prompt_type=prompt_type, user_input=user_input, context=context, runtime_context=runtime_context)
    if grounded:
        prompt.messages[0]["content"] += ANSWER_CONTRACT
    result = generate_text(
        prompt,
        prompt_type=prompt_type,
        model=model,
        model_tier=model_tier,
        temperature=temperature,
        allow_mock=allow_mock,
    )
    if grounded:
        result = validate_answer(result, sources)
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
            "provider_state": result.provider_state,
            "sources": result.sources,
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
    elif job.user_id != getattr(user, "id", None):
        raise PermissionDenied()
    elif job.prompt_type != prompt_type or job.input_json.get("user_input") != user_input:
        raise ValidationError("This request key has already been used for a different request.")
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
        runtime_context = job.input_json.get("runtime_context") or {}
        if job.source == AIRequestLog.Sources.CRM:
            assert_business_access(job.user, job.business)
            assert_can(job.user, job.business, Resources.AI_ASSISTANT, Actions.SUGGEST)
            runtime_context = {"crm_context": build_crm_context(job.business, user=job.user)}
        result, log = run_ai_request(
            business=job.business,
            user=job.user,
            source=job.source,
            prompt_type=job.prompt_type,
            user_input=job.input_json.get("user_input", ""),
            input_json=runtime_context,
            allow_mock=False,
        )
        job.status = AIJob.Statuses.SUCCEEDED
        job.result_json = {
            "answer": result.output_text,
            "provider": result.provider,
            "model": result.model,
            "tokens_used": result.tokens_used,
            "log_id": log.id,
            "is_mock": result.is_mock,
            "provider_state": result.provider_state,
            "sources": result.sources,
            "context": runtime_context.get("crm_context", {}).get("summary", {}),
        }
        job.request_log = log
        job.completed_at = timezone.now()
        job.locked_at = None
        job.save(
            update_fields=["status", "result_json", "request_log", "completed_at", "locked_at", "updated_at"]
        )
    except Exception as exc:
        logger.warning("ai.job_failed", extra={"ai_job_id": job.id, "error_type": type(exc).__name__})
        job.error = "AI request could not be completed. Please retry or continue manually."
        job.locked_at = None
        if job.attempts < job.max_attempts and getattr(exc, "retryable", not isinstance(exc, (PermissionError, PermissionDenied, ValidationError))):
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
