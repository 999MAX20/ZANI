export const pilotMerchantJourneys = [
  {
    id: "J01-inbox-lead-next-action",
    title: "Inbox to lead and next action",
    routeIds: ["INBOX-CONVERSATIONS", "CRM-LEADS-LIST", "EXEC-TASKS-LIST"],
    roles: ["owner", "administrator", "manager", "operator"],
    persistenceEntities: ["BotConversation", "Lead", "Task", "ActivityEvent"],
    browserEvidence: [
      {
        file: "frontend/e2e/entity-workspaces.spec.ts",
        marker: "client, lead, deal, appointment, conversation and task workspaces render executable action bars",
      },
    ],
    backendEvidence: [
      {
        file: "apps/core/tests_business_flows_e2e.py",
        marker: "test_inbox_message_ai_qualification_creates_lead_and_task_flow",
      },
    ],
    status: "PASS",
  },
  {
    id: "J02-lead-client-deal",
    title: "Lead to client and deal lifecycle",
    routeIds: ["CRM-LEADS-LIST", "CRM-CLIENTS-LIST", "CRM-DEALS-BOARD"],
    roles: ["owner", "administrator", "manager"],
    persistenceEntities: ["Lead", "Client", "Deal", "ActivityEvent", "AuditLog"],
    browserEvidence: [
      {
        file: "frontend/e2e/entity-workspaces.spec.ts",
        marker: "client, lead, deal, appointment, conversation and task workspaces render executable action bars",
      },
    ],
    backendEvidence: [
      {
        file: "apps/core/tests_business_flows_e2e.py",
        marker: "test_lead_to_deal_won_and_lost_flow",
      },
    ],
    status: "PASS",
  },
  {
    id: "J03-deal-stage-task-terminal",
    title: "Deal stage, task and terminal state",
    routeIds: ["CRM-DEALS-BOARD", "CRM-DEAL-WORKSPACE", "EXEC-TASKS-LIST"],
    roles: ["owner", "administrator", "manager"],
    persistenceEntities: ["Deal", "PipelineStage", "Task", "ActivityEvent", "AuditLog"],
    browserEvidence: [
      {
        file: "frontend/e2e/deals-kanban-density.spec.ts",
        marker: "deal kanban exposes one dense localized canonical pipeline",
      },
    ],
    backendEvidence: [
      {
        file: "apps/core/tests_business_flows_e2e.py",
        marker: "test_lead_to_deal_won_and_lost_flow",
      },
      {
        file: "apps/tasks/tests.py",
        marker: "test_task_status_actions",
      },
    ],
    status: "PASS",
  },
  {
    id: "J04-client-appointment-lifecycle",
    title: "Client appointment lifecycle",
    routeIds: ["CRM-CLIENTS-LIST", "EXEC-CALENDAR", "EXEC-APPOINTMENT-WORKSPACE"],
    roles: ["owner", "administrator", "manager", "operator", "specialist"],
    persistenceEntities: ["Client", "Appointment", "Task", "ActivityEvent", "AuditLog"],
    browserEvidence: [
      {
        file: "frontend/e2e/smoke.spec.ts",
        marker: "calendar deep link selects appointment and lifecycle action works",
      },
      {
        file: "frontend/e2e/smoke.spec.ts",
        marker: "business owner can reschedule appointment from calendar UI",
      },
    ],
    backendEvidence: [
      {
        file: "apps/core/tests_business_flows_e2e.py",
        marker: "test_appointment_reschedule_cancel_and_no_show_flow",
      },
    ],
    status: "PASS",
  },
  {
    id: "J05-conversation-crm-follow-up",
    title: "Conversation to CRM follow-up",
    routeIds: ["INBOX-CONVERSATION-DETAIL", "EXEC-TASKS-LIST"],
    roles: ["owner", "administrator", "manager", "operator"],
    persistenceEntities: ["BotConversation", "Task", "ActivityEvent", "AuditLog"],
    browserEvidence: [
      {
        file: "frontend/e2e/entity-workspaces.spec.ts",
        marker: "client, lead, deal, appointment, conversation and task workspaces render executable action bars",
      },
    ],
    backendEvidence: [
      {
        file: "apps/conversations/tests_inbox_tasks.py",
        marker: "test_create_task_from_inbox_uses_service_contract",
      },
    ],
    status: "PASS",
  },
  {
    id: "J06-import-validation-duplicates",
    title: "Import validation, duplicate preview and visible result",
    routeIds: ["CRM-LEADS-LIST", "CRM-CLIENTS-LIST"],
    roles: ["owner", "administrator", "manager", "operator"],
    persistenceEntities: ["ImportJob", "Client", "Lead", "BusinessEvent"],
    browserEvidence: [
      {
        file: "frontend/e2e/merchant-journeys-certification.spec.ts",
        marker: "FC-J06 import validation, duplicates and visible records persist through the Leads UI",
      },
    ],
    backendEvidence: [
      {
        file: "apps/core/tests_import_export.py",
        marker: "test_csv_leads_import_previews_existing_client_duplicate",
      },
      {
        file: "apps/core/tests_import_export.py",
        marker: "test_csv_leads_import_creates_clients_and_leads",
      },
    ],
    status: "PASS",
  },
  {
    id: "J07-team-access-role-change",
    title: "Team access role change",
    routeIds: ["SETUP-SETTINGS"],
    roles: ["owner", "administrator"],
    persistenceEntities: ["BusinessMember", "BusinessRole", "AuditLog"],
    browserEvidence: [
      {
        file: "frontend/e2e/merchant-journeys-certification.spec.ts",
        marker: "FC-J07 owner role change is applied by the Team UI and restored",
      },
    ],
    backendEvidence: [
      {
        file: "apps/businesses/tests_access.py",
        marker: "test_owner_can_manage_team_members",
      },
      {
        file: "apps/businesses/tests_access.py",
        marker: "test_team_screen_cannot_promote_member_to_owner",
      },
      {
        file: "apps/businesses/tests_access.py",
        marker: "test_role_permission_change_is_audit_logged",
      },
    ],
    status: "PASS",
  },
  {
    id: "J08-manager-workload-funnel-team",
    title: "Manager workload, funnel and team visibility",
    routeIds: ["MERCHANT-DASHBOARD", "EXEC-TASKS-LIST", "MGMT-ANALYTICS"],
    roles: ["manager"],
    persistenceEntities: ["Task", "Lead", "Deal", "BusinessMember"],
    browserEvidence: [
      {
        file: "frontend/e2e/daily-workspaces.spec.ts",
        marker: "F-201 desktop roles receive legitimate daily routes and controls",
      },
    ],
    backendEvidence: [
      {
        file: "apps/tasks/tests.py",
        marker: "test_task_workload_groups_active_tasks_by_assignee",
      },
      {
        file: "apps/analytics/tests.py",
        marker: "test_manager_scope_limits_crm_reporting_metrics",
      },
    ],
    status: "PASS",
  },
  {
    id: "J09-assigned-daily-queue",
    title: "Assigned daily queue across desktop and mobile",
    routeIds: ["MERCHANT-DASHBOARD", "EXEC-TASKS-LIST", "EXEC-CALENDAR"],
    roles: ["operator", "specialist"],
    persistenceEntities: ["Task", "Lead", "Appointment", "BusinessMember"],
    browserEvidence: [
      {
        file: "frontend/e2e/daily-workspaces.spec.ts",
        marker: "F-201 desktop roles receive legitimate daily routes and controls",
      },
      {
        file: "frontend/e2e/daily-workspaces.spec.ts",
        marker: "F-201 mobile owner, manager, operator and specialist daily routes stay usable",
      },
    ],
    backendEvidence: [
      {
        file: "apps/core/tests_b2_roles_queues.py",
        marker: "test_daily_queues_are_role_and_team_scoped",
      },
    ],
    status: "PASS",
  },
  {
    id: "J10-ai-suggestion-approval-audit",
    title: "Grounded AI suggestion, approval, execution and audit",
    routeIds: ["AI-ASSISTANT", "MGMT-TIMELINE"],
    roles: ["owner", "administrator", "manager"],
    persistenceEntities: ["AIToolCallLog", "ApprovalRequest", "Task", "AuditLog"],
    browserEvidence: [
      {
        file: "frontend/e2e/merchant-journeys-certification.spec.ts",
        marker: "FC-J10 grounded AI suggestion requires approval and persists task plus audit",
      },
    ],
    backendEvidence: [
      {
        file: "apps/core/tests_business_flows_e2e.py",
        marker: "test_ai_suggests_action_user_approves_service_executes_and_audit_exists_flow",
      },
    ],
    status: "PASS",
  },
];
