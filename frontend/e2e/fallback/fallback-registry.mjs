/**
 * FB-001 policy registry.
 *
 * Runtime inventories are derived from source by check-fallback-inventory.mjs.
 * Keep only policy decisions here so the generated report never becomes a
 * second manual source of truth.
 */

import { appErrorCodeRegistry } from "../../src/api/appErrorRegistry.ts";

export const fallbackCategories = {
  validation: { copyFamily: "fallback.validation", defaultSurface: "field_error_summary", recovery: "fix_fields" },
  authentication: { copyFamily: "fallback.authentication", defaultSurface: "session_notice", recovery: "sign_in" },
  permission: { copyFamily: "fallback.permission", defaultSurface: "forbidden_state", recovery: "safe_navigation" },
  not_found: { copyFamily: "fallback.not_found", defaultSurface: "page_fallback", recovery: "return_to_list" },
  conflict: { copyFamily: "fallback.conflict", defaultSurface: "action_feedback", recovery: "refresh_then_review" },
  rate_limit: { copyFamily: "fallback.rate_limit", defaultSurface: "action_feedback", recovery: "wait_for_server_delay" },
  offline: { copyFamily: "fallback.offline", defaultSurface: "connectivity_banner", recovery: "reconnect" },
  temporary: { copyFamily: "fallback.temporary", defaultSurface: "inline_or_page_fallback", recovery: "retry_safe_operation" },
  provider: { copyFamily: "fallback.provider", defaultSurface: "delivery_or_integration_details", recovery: "repair_or_retry_once" },
  internal: { copyFamily: "fallback.internal", defaultSurface: "page_fallback", recovery: "reload_or_contact_support" },
};

export const errorCodeRegistry = appErrorCodeRegistry.map((entry) => ({
  ...entry,
  copyFamily: `${fallbackCategories[entry.category].copyFamily}.${entry.code}`,
}));

const merchant = (permissionOwner, retryLocation = "owning_page") => ({
  permissionOwner,
  retryLocation,
});

export const apiModulePolicies = {
  activities: merchant("analytics:view"),
  ai: merchant("ai_assistant:view", "ai_action_or_job_details"),
  analytics: merchant("analytics:view"),
  appointments: merchant("appointments:view", "calendar_or_appointment_workspace"),
  auth: merchant("authenticated_user", "account_security"),
  automations: merchant("automations:view", "automation_run_details"),
  billing: merchant("owner_or_administrator", "settings_billing"),
  bots: merchant("integrations:view", "bot_or_channel_details"),
  businesses: merchant("business_member", "settings_business"),
  clients: merchant("clients:view", "client_list_or_workspace"),
  connectors: merchant("integrations:view", "integration_details"),
  crmCards: merchant("entity_view_permission", "crm_entity_drawer"),
  customFields: merchant("settings:view", "settings_custom_fields"),
  deals: merchant("deals:view", "deal_board_or_workspace"),
  developers: merchant("owner_or_administrator", "developer_delivery_details"),
  fileAttachments: merchant("entity_update_permission", "crm_entity_drawer"),
  importExport: merchant("entity_export_or_import_permission", "import_export_status"),
  inbox: merchant("conversations:view", "conversation_delivery_details"),
  leadForms: merchant("leads:view", "lead_form_settings"),
  leads: merchant("leads:view", "lead_list_or_workspace"),
  notifications: merchant("authenticated_user", "notification_center"),
  outreach: merchant("notifications:view", "campaign_or_recipient_details"),
  pilot: merchant("owner_or_administrator", "pilot_readiness"),
  platform: merchant("platform_admin", "platform_operation_details"),
  pricing: merchant("integrations:view", "pricing_operation_details"),
  quickReplies: merchant("conversations:view", "inbox_composer"),
  resources: merchant("settings:view", "resource_settings"),
  security: merchant("owner_or_administrator", "account_security"),
  services: merchant("settings:view", "service_settings"),
  tasks: merchant("tasks:view", "task_list_or_workspace"),
  team: merchant("owner_or_administrator", "team_settings"),
  token: merchant("anonymous_or_authenticated", "authentication_flow"),
  workingHours: merchant("settings:view", "working_hours_settings"),
  workQueues: merchant("business_member", "dashboard_work_queue"),
};

export const idempotentMutationRules = [
  {
    method: "POST",
    endpointPattern: "^/api/tasks/$",
    guarantee: "conditional_idempotency_key",
    evidence: "apps.tasks.views.TaskViewSet uses IdempotentCRMCreateMixin",
  },
  {
    method: "POST",
    endpointPattern: "^/api/appointments/$",
    guarantee: "conditional_idempotency_key",
    evidence: "apps.scheduling.views.AppointmentViewSet uses IdempotentCRMCreateMixin",
  },
  {
    method: "POST",
    endpointPattern: "^/api/leads/:param/(create-appointment|create-task)/$",
    guarantee: "conditional_idempotency_key",
    evidence: "lead CRM commands use run_idempotent_crm_command",
  },
  {
    method: "POST",
    endpointPattern: "^/api/inbox/conversations/:param/(messages|create-task|create-appointment)/$",
    guarantee: "conditional_idempotency_key",
    evidence: "Inbox commands and outbound delivery persist idempotency keys",
  },
  {
    method: "POST",
    endpointPattern: "^/api/ai/(jobs|actions)/",
    guarantee: "domain_idempotency_key",
    evidence: "AI jobs and approved actions persist business-scoped idempotency keys",
  },
  {
    method: "POST",
    endpointPattern: "^/api/(exports|export-jobs)/",
    guarantee: "job_claim_idempotency",
    evidence: "export jobs are claimed and processed once per job record",
  },
];

export const backgroundTaskPolicies = {
  "bots.process_outbound_message": { permissionOwner: "conversations:send", idempotency: "message_delivery_key", retryLocation: "conversation_delivery_details" },
  "bots.process_due_outbound_messages": { permissionOwner: "system", idempotency: "locked_due_message_claim", retryLocation: "conversation_delivery_details" },
  "pricing.run_kaspi_pricing_cycle": { permissionOwner: "pricing_operator", idempotency: "rule_and_change_log_guard", retryLocation: "pricing_operation_details" },
  "notifications.process_due_notifications": { permissionOwner: "system", idempotency: "notification_delivery_state", retryLocation: "notification_center" },
  "automations.process_automation_run": { permissionOwner: "automations:manage", idempotency: "business_and_idempotency_key", retryLocation: "automation_run_details" },
  "automations.process_due_automation_runs": { permissionOwner: "system", idempotency: "locked_due_run_claim", retryLocation: "automation_run_details" },
  "automations.emit_task_overdue_runs": { permissionOwner: "system", idempotency: "derived_automation_key", retryLocation: "automation_run_details" },
  "routing.process_cycle": { permissionOwner: "system", idempotency: "cycle_state_guard", retryLocation: "work_queue_status" },
  "ai.process_job": { permissionOwner: "ai_assistant:use", idempotency: "business_and_idempotency_key", retryLocation: "ai_job_details" },
  "ai.process_due_jobs": { permissionOwner: "system", idempotency: "locked_due_job_claim", retryLocation: "ai_job_details" },
  "exports.process_job": { permissionOwner: "requesting_user", idempotency: "job_state_claim", retryLocation: "import_export_status" },
  "exports.process_due_jobs": { permissionOwner: "system", idempotency: "locked_due_job_claim", retryLocation: "import_export_status" },
  "crm.prune_command_idempotency": { permissionOwner: "system", idempotency: "bounded_expiry_delete", retryLocation: "none" },
};

export const providerStatusSources = [
  ["apps/integrations/models.py", "IntegrationEventLog"],
  ["apps/integrations/models.py", "BusinessConnector"],
  ["apps/integrations/models.py", "BusinessEvent"],
  ["apps/integrations/models.py", "ConnectorSyncRun"],
  ["apps/integrations/models.py", "WebhookDeliveryLog"],
  ["apps/bots/models.py", "BotChannel"],
  ["apps/bots/models.py", "BotMessage"],
  ["apps/automations/models.py", "AutomationRun"],
  ["apps/outreach/models.py", "OutreachCampaign"],
  ["apps/outreach/models.py", "OutreachRecipient"],
  ["apps/pricing/models.py", "KaspiPricingRecommendation"],
  ["apps/pricing/models.py", "KaspiPriceChangeLog"],
  ["apps/ai_core/models.py", "AIJob"],
  ["apps/core/models.py", "ImportJob"],
  ["apps/core/models.py", "ExportJob"],
];

export const providerStatusPolicies = {
  active: ["none", "status.active", "none"],
  applied: ["none", "status.succeeded", "none"],
  approved: ["none", "status.approved", "none"],
  blocked: ["conflict", "status.blocked", "review_operation"],
  cancelled: ["none", "status.cancelled", "none"],
  connected: ["none", "status.connected", "none"],
  delivering: ["temporary", "status.delivering", "delivery_details"],
  disabled: ["permission", "status.disabled", "integration_settings"],
  disconnected: ["provider", "status.disconnected", "integration_settings"],
  draft: ["none", "status.draft", "none"],
  error: ["provider", "status.failed", "owned_details"],
  expired_credentials: ["authentication", "status.expired_credentials", "integration_settings"],
  failed: ["temporary", "status.failed", "owned_details"],
  ignored: ["none", "status.ignored", "none"],
  imported: ["none", "status.succeeded", "none"],
  mocked: ["none", "status.mocked", "none"],
  needs_attention: ["provider", "status.needs_attention", "integration_settings"],
  paused: ["none", "status.paused", "none"],
  pending: ["temporary", "status.pending", "owned_details"],
  pending_request: ["temporary", "status.pending_request", "integration_settings"],
  processed: ["none", "status.succeeded", "none"],
  proposed: ["none", "status.proposed", "none"],
  provider_configuring: ["temporary", "status.configuring", "integration_settings"],
  queued: ["temporary", "status.queued", "owned_details"],
  ready: ["none", "status.ready", "none"],
  received: ["none", "status.received", "none"],
  rejected: ["conflict", "status.rejected", "review_operation"],
  retry_scheduled: ["temporary", "status.retry_scheduled", "owned_details"],
  running: ["temporary", "status.running", "owned_details"],
  scheduled: ["temporary", "status.scheduled", "owned_details"],
  sent: ["none", "status.sent", "none"],
  setup_required: ["provider", "status.setup_required", "integration_settings"],
  simulated: ["none", "status.simulated", "none"],
  skipped: ["none", "status.skipped", "owned_details"],
  succeeded: ["none", "status.succeeded", "none"],
  success: ["none", "status.succeeded", "none"],
  syncing: ["temporary", "status.syncing", "integration_details"],
  uploaded: ["none", "status.uploaded", "none"],
  previewed: ["none", "status.previewed", "none"],
  waiting: ["temporary", "status.waiting", "owned_details"],
};

export const defectPrecedents = [
  "ZD-001",
  "ZD-002",
  "ZD-003",
  "ZD-004",
  "ZR-002",
  "ZR-004",
  "ZR-005",
  "ZR-006",
  "ZR-007",
];
