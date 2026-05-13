def build_prompt(prompt_type, user_input, context=None):
    context = context or []
    context_text = "\n".join(
        f"- {item.get('title')}: {item.get('content')}" for item in context
    )
    if context_text:
        return f"Prompt type: {prompt_type}\nContext:\n{context_text}\n\nUser input:\n{user_input}"
    return f"Prompt type: {prompt_type}\nUser input:\n{user_input}"
