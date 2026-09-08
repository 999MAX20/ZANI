export const fb010MerchantRoles = [
  "owner",
  "administrator",
  "manager",
  "operator",
  "specialist",
];

export const fb010ViewportProjects = [
  "desktop-chromium",
  "mobile-chromium",
];

export const fb010FailureStates = [
  {
    id: "success",
    category: "none",
    expectedSurface: "success",
    recovery: "continue",
  },
  {
    id: "empty",
    category: "none",
    expectedSurface: "empty",
    recovery: "create_or_adjust",
  },
  {
    id: "validation",
    category: "validation",
    expectedSurface: "field_error_summary",
    recovery: "focus_invalid_field",
  },
  {
    id: "permission",
    category: "permission",
    expectedSurface: "permission_fallback",
    recovery: "safe_navigation",
  },
  {
    id: "not_found",
    category: "not_found",
    expectedSurface: "page_fallback",
    recovery: "return_to_list",
  },
  {
    id: "conflict",
    category: "conflict",
    expectedSurface: "inline_fallback",
    recovery: "refresh_then_review",
  },
  {
    id: "rate_limit",
    category: "rate_limit",
    expectedSurface: "inline_fallback",
    recovery: "server_delayed_retry",
  },
  {
    id: "offline",
    category: "offline",
    expectedSurface: "connectivity_banner",
    recovery: "reconnect",
  },
  {
    id: "temporary",
    category: "temporary",
    expectedSurface: "inline_fallback",
    recovery: "retry_safe_operation",
  },
  {
    id: "provider",
    category: "provider",
    expectedSurface: "inline_fallback",
    recovery: "owned_provider_recovery",
  },
  {
    id: "session_expiry",
    category: "authentication",
    expectedSurface: "page_fallback",
    recovery: "sign_in",
  },
  {
    id: "unexpected",
    category: "internal",
    expectedSurface: "route_error_boundary",
    recovery: "safe_navigation",
  },
];

const sharedBrowserEvidence = [
  "e2e/failure-certification.spec.ts",
  "e2e/action-feedback.spec.ts",
  "e2e/daily-workspaces.spec.ts",
  "e2e/smoke.spec.ts",
];

const sharedBackendEvidence = [
  "apps/core/tests_b3_contracts.py",
  "apps/core/tests_tenant_isolation.py",
  "apps/core/tests_api_exceptions.py",
];

function journey(entry) {
  return {
    viewports: fb010ViewportProjects,
    browserEvidence: sharedBrowserEvidence,
    backendEvidence: sharedBackendEvidence,
    ...entry,
  };
}

export const fb010CriticalJourneys = [
  journey({
    id: "J01-inbox-lead-next-action",
    routeIds: ["INBOX-CONVERSATIONS", "CRM-LEADS-LIST", "EXEC-TASKS-LIST"],
    apiModules: ["inbox", "leads", "tasks"],
    roles: ["owner", "administrator", "manager", "operator"],
    browserEvidence: [...sharedBrowserEvidence, "e2e/entity-workspaces.spec.ts"],
    backendEvidence: [...sharedBackendEvidence, "apps/conversations/tests_inbox_tasks.py", "apps/leads/tests_crm_light.py"],
  }),
  journey({
    id: "J02-lead-client-deal",
    routeIds: ["CRM-LEADS-LIST", "CRM-CLIENTS-LIST", "CRM-DEALS-BOARD"],
    apiModules: ["leads", "clients", "deals"],
    roles: ["owner", "administrator", "manager"],
    browserEvidence: [...sharedBrowserEvidence, "e2e/entity-workspaces.spec.ts", "e2e/crm-workspace-overlay.spec.ts"],
    backendEvidence: [...sharedBackendEvidence, "apps/leads/tests_crm_light.py", "apps/clients/tests.py", "apps/crm/tests.py"],
  }),
  journey({
    id: "J03-deal-stage-task-terminal",
    routeIds: ["CRM-DEALS-BOARD", "CRM-DEAL-WORKSPACE", "EXEC-TASKS-LIST"],
    apiModules: ["deals", "tasks"],
    roles: ["owner", "administrator", "manager"],
    browserEvidence: [...sharedBrowserEvidence, "e2e/entity-workspaces.spec.ts", "e2e/deals-kanban-density.spec.ts"],
    backendEvidence: [...sharedBackendEvidence, "apps/crm/tests.py", "apps/tasks/tests.py"],
  }),
  journey({
    id: "J04-client-appointment-lifecycle",
    routeIds: ["CRM-CLIENTS-LIST", "EXEC-CALENDAR", "EXEC-APPOINTMENT-WORKSPACE"],
    apiModules: ["clients", "appointments"],
    roles: fb010MerchantRoles,
    browserEvidence: [...sharedBrowserEvidence, "e2e/entity-workspaces.spec.ts"],
    backendEvidence: [...sharedBackendEvidence, "apps/clients/tests.py", "apps/scheduling/tests.py"],
  }),
  journey({
    id: "J05-conversation-crm-follow-up",
    routeIds: ["INBOX-CONVERSATION-DETAIL", "EXEC-TASKS-LIST"],
    apiModules: ["inbox", "tasks", "crmCards"],
    roles: ["owner", "administrator", "manager", "operator"],
    browserEvidence: [...sharedBrowserEvidence, "e2e/entity-workspaces.spec.ts"],
    backendEvidence: [...sharedBackendEvidence, "apps/conversations/tests_inbox_tasks.py", "apps/tasks/tests.py"],
  }),
  journey({
    id: "J06-import-validation-duplicates",
    routeIds: ["CRM-LEADS-LIST", "CRM-CLIENTS-LIST"],
    apiModules: ["importExport", "leads", "clients"],
    roles: ["owner", "administrator", "manager", "operator"],
    browserEvidence: [...sharedBrowserEvidence, "e2e/merchant-journeys-certification.spec.ts"],
    backendEvidence: [...sharedBackendEvidence, "apps/core/tests_import_export.py", "apps/core/tests_import_samples.py"],
  }),
  journey({
    id: "J07-team-access-role-change",
    routeIds: ["SETUP-SETTINGS"],
    apiModules: ["team", "businesses"],
    roles: ["owner", "administrator"],
    browserEvidence: [...sharedBrowserEvidence, "e2e/merchant-journeys-certification.spec.ts"],
    backendEvidence: [...sharedBackendEvidence, "apps/businesses/tests_access.py", "apps/accounts/tests.py"],
  }),
  journey({
    id: "J08-manager-workload-funnel-team",
    routeIds: ["MERCHANT-DASHBOARD", "EXEC-TASKS-LIST", "MGMT-ANALYTICS"],
    apiModules: ["workQueues", "tasks", "analytics"],
    roles: ["manager"],
    backendEvidence: [...sharedBackendEvidence, "apps/core/tests_work_queues.py", "apps/analytics/tests.py"],
  }),
  journey({
    id: "J09-assigned-daily-queue",
    routeIds: ["MERCHANT-DASHBOARD", "EXEC-TASKS-LIST", "EXEC-CALENDAR"],
    apiModules: ["workQueues", "tasks", "appointments"],
    roles: ["operator", "specialist"],
    backendEvidence: [...sharedBackendEvidence, "apps/core/tests_b2_roles_queues.py", "apps/tasks/tests.py", "apps/scheduling/tests.py"],
  }),
  journey({
    id: "J10-ai-suggestion-approval-audit",
    routeIds: ["AI-ASSISTANT", "MGMT-TIMELINE"],
    apiModules: ["ai", "activities"],
    roles: ["owner", "administrator", "manager"],
    browserEvidence: [...sharedBrowserEvidence, "e2e/merchant-journeys-certification.spec.ts"],
    backendEvidence: [...sharedBackendEvidence, "apps/ai_core/tests.py", "apps/activities/tests.py"],
  }),
];

export function createFb010Matrix() {
  return fb010CriticalJourneys.flatMap((journeyEntry) =>
    journeyEntry.roles.flatMap((role) =>
      journeyEntry.viewports.flatMap((viewport) =>
        fb010FailureStates.map((state) => ({
          id: `${journeyEntry.id}::${role}::${viewport}::${state.id}`,
          journey: journeyEntry.id,
          role,
          viewport,
          state: state.id,
          category: state.category,
          expectedSurface: state.expectedSurface,
          recovery: state.recovery,
          routeIds: journeyEntry.routeIds,
          apiModules: journeyEntry.apiModules,
          browserEvidence: journeyEntry.browserEvidence,
          backendEvidence: journeyEntry.backendEvidence,
        })),
      ),
    ),
  );
}
