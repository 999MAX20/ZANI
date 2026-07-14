# Code Review Checklist

- Tenant scoping happens before lookup, aggregation, mutation, export, notification, or background processing.
- Backend permissions and active membership are checked for every protected action.
- Lifecycle fields change only through domain services/state machines with audit/activity side effects.
- Related entities, owners, assignees, stages, and source records belong to the same Business.
- Serializers do not leak secrets, hidden entities, unsafe metadata, or incompatible contract changes.
- Error, retry, idempotency, concurrency, and partial-failure paths preserve data integrity.
- Frontend uses API clients and handles loading/error/empty/forbidden states.
- AI output is permission-scoped and source-grounded; mutations retain confirmation and approval gates.
- Integrations stay behind provider layers and do not call real networks in tests.
- Migrations, constraints, indexes, env, deployment, and rollback consequences are accounted for.
- Tests cover happy path, denial, tenant isolation, and regressions proportional to risk.
