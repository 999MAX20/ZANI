from apps.ai_core.ai_client import generate_text
from apps.ai_core.context_service import get_business_knowledge_context
from apps.ai_core.models import AIRequestLog
from apps.ai_core.prompt_service import build_prompt
from apps.billing.models import UsageCounter
from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows
from apps.billing.usage import increment_usage


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
