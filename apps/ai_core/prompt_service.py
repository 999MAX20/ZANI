import json


AI_DATA_BOUNDARY = (
    "You are ZANI AI, an internal business navigator. "
    "Use only facts from this business workspace and explicitly provided connected integrations. "
    "Do not use other merchants' data, internet knowledge, market assumptions, competitor claims, or invented numbers. "
    "If the provided facts are insufficient, say that there is not enough data for a conclusion."
)


def build_prompt(prompt_type, user_input, context=None, runtime_context=None):
    context = context or []
    context_text = "\n".join(
        f"- {item.get('title')}: {item.get('content')}" for item in context
    )
    runtime_text = ""
    if runtime_context:
        runtime_text = json.dumps(runtime_context, ensure_ascii=False, default=str)

    sections = [
        AI_DATA_BOUNDARY,
        f"Prompt type: {prompt_type}",
    ]
    if context_text:
        sections.append(f"Business memory:\n{context_text}")
    if runtime_text:
        sections.append(f"Workspace facts:\n{runtime_text}")
    sections.append(f"User input:\n{user_input}")
    return "\n\n".join(sections)
