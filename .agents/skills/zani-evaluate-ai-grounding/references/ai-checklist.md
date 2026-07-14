# AI Grounding Checklist

- Scope every input source through the requesting user's backend permissions and active Business.
- Cite stable entity or BusinessEvent identifiers for recommendations and briefs.
- Treat missing, stale, or forbidden evidence as no data; do not fill gaps with plausible copy.
- Keep AI suggestions optional and distinguish suggestions from completed actions.
- Validate tool arguments server-side and re-check permissions at execution time.
- Bind approval to the exact tool call, payload, business, actor, and validity window.
- Sanitize request logs, tool logs, audit metadata, errors, and serialized responses.
- Record provider, model, latency, success/error, and cost metadata without raw sensitive messages.
- Provide deterministic or controlled fallback behavior when AI is disabled, unavailable, or unconfigured.
- Cover happy path, no-data, forbidden source, cross-tenant, approval denial, and provider error where applicable.
