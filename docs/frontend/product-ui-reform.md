# ZANI Product/UI Reform

## Current Diagnosis

ZANI has a strong backend foundation, but the product surface was built as many task completions instead of a small set of workflow-first screens. The reform goal is to stop adding UI blocks and make the product usable around the core business loops.

## Non-Negotiable Product Loops

1. Inbound lead or bot conversation appears in CRM.
2. Operator or manager responds, qualifies, and assigns ownership.
3. Qualified lead becomes a client and deal.
4. Deal moves through pipeline with explicit next action.
5. Integrations emit business events: message, order, payment, stock, sync error.
6. AI Analyst summarizes risks and proposes confirmable actions.

## Primary Navigation

Keep the main merchant navigation limited to:

- Home: operational cockpit for today.
- Leads: inbound demand and qualification.
- Deals: pipeline and next actions.
- Inbox: conversations, handoff, and AI draft replies.
- Integrations: connection status, sync events, errors.
- AI Navigator: facts, risks, and confirmable actions.

Secondary routes can remain accessible by contextual links:

- Clients
- Tasks
- Calendar / Appointments
- Services / Resources / Working hours
- Analytics
- Automations
- Settings
- Pilot / platform operations

## Page Rules

- Each page must have one primary job and one primary action.
- Remove long explanatory panels from work screens.
- Do not show roadmap modules as if they are active product functionality.
- Prefer dense operational lists, status rows, drawers, and focused action panels.
- AI must be grounded in CRM/integration facts, not generic chat copy.
- Every suggested AI action must be confirmable and logged.

## First Reform Slice

1. Simplify sidebar and mobile navigation to the primary product loops.
2. Keep hidden routes working so existing code and deep links do not break.
3. Refocus Dashboard on urgent work, integration health, and AI daily brief.
4. Refactor overloaded pages one by one, starting with Integrations and Inbox.
