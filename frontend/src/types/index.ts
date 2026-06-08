export type Id = number;

export type User = {
  id: Id;
  email: string;
  full_name?: string;
  phone?: string;
  role?: "platform_admin" | "platform_manager" | "business_owner" | "business_manager" | "business_operator" | "manager" | "admin" | "operator" | "marketer" | "accountant" | "support" | "staff";
  is_platform_user?: boolean;
  is_merchant_user?: boolean;
  is_business_manager?: boolean;
};

export type Business = {
  id: Id;
  owner: Id;
  name: string;
  slug: string;
  business_type: "dentistry" | "beauty" | "sauna" | "autoservice" | "education" | "medical" | "other";
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  instagram: string;
  timezone: string;
  language: "ru" | "kk" | "en" | string;
  currency: "KZT" | "USD" | "EUR" | "RUB" | string;
  legal_name: string;
  tax_id: string;
  invoice_email: string;
  brand_color: string;
  brand_logo_url: string;
  cancellation_policy: string;
  prepayment_policy: string;
  sla_minutes: number;
  booking_buffer_minutes: number;
  landing_id?: string;
  landing_domain?: string;
  landing_preview_url?: string;
  status: "active" | "inactive" | "trial" | "blocked";
  created_at: string;
  updated_at: string;
};

export type OnboardingTemplate = {
  key: Business["business_type"];
  label: string;
  services: string[];
  resources: string[];
  stages: string[];
  quick_replies: string[];
};

export type OnboardingChecklistItem = {
  key: string;
  title: string;
  is_completed: boolean;
};

export type OnboardingStatus = {
  business: Id;
  progress: number;
  completed: number;
  total: number;
  items: OnboardingChecklistItem[];
};

export type ApplyOnboardingTemplateResponse = {
  business: Id;
  template_key: Business["business_type"];
  pipeline: Id;
  services_count: number;
  resources_count: number;
  quick_replies_count: number;
  automations_count: number;
  checklist: OnboardingStatus;
};

export type SubscriptionPlan = {
  id: Id;
  name: string;
  code: string;
  monthly_price: string;
  description: string;
  is_active: boolean;
  limits_json: Record<string, unknown>;
  features_json: { features?: string[] } & Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: Id;
  business: Id;
  plan?: SubscriptionPlan | null;
  status: "trial" | "active" | "overdue" | "cancelled" | "paused";
  billing_email: string;
  payment_method: string;
  invoice_details_json: Record<string, unknown>;
  requested_plan?: Id | null;
  requested_plan_name?: string | null;
  plan_change_requested_at?: string | null;
  started_at: string | null;
  next_payment_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UsageSummaryItem = {
  metric: "ai_requests" | "bot_messages" | "users" | "conversations" | "storage_mb";
  value: number;
  value_bytes?: number;
  limit: number | null;
  limit_bytes?: number | null;
  is_limited: boolean;
  is_over_limit: boolean;
  period_start?: string;
  period_end?: string;
};

export type EntitlementSummaryItem = {
  metric: "ai_requests" | "bot_messages" | "users" | "conversations" | "storage_mb" | "bots" | "automations";
  value: number;
  limit: number | null;
  remaining: number | null;
  is_limited: boolean;
  is_over_limit: boolean;
  plan_code: string | null;
};

export type PlatformOperationsSummary = {
  total_monitored: number;
  attention_merchants: number;
  risk_merchants: number;
  no_sales_data_merchants: number;
  form_error_merchants: number;
  handoff_conversations: number;
  new_leads_30d: number;
  form_errors_30d: number;
  failed_connectors: number;
};

export type PlatformMerchantOperations = {
  lead_count: number;
  new_leads: number;
  clients_count: number;
  open_tasks: number;
  unread_conversations: number;
  handoff_conversations: number;
  failed_connectors: number;
  pending_connectors?: number;
  connected_connectors: number;
  form_errors: number;
  lead_forms: number;
  sales_events: number;
  latest_activity_at: string;
};

export type PlatformMerchantHealth = {
  score: number;
  status: "healthy" | "setup" | "attention" | "risk" | string;
  checks: Record<string, boolean>;
  blockers: string[];
  next_action: string;
};


export type PlatformSupportAction = {
  id: Id;
  action_type: string;
  note: string;
  status: string;
  created_at: string;
  actor_email: string | null;
};

export type PlatformSupportStep = {
  key: string;
  label: string;
  href: string;
};

export type PlatformSupportWorkflow = {
  priority: "low" | "medium" | "high" | string;
  summary: string;
  next_steps: PlatformSupportStep[];
  recent_actions: PlatformSupportAction[];
};

export type PlatformOverview = {
  total_businesses: number;
  active_businesses: number;
  trial_businesses: number;
  active_subscriptions: number;
  mrr_estimate: string;
  total_users: number;
  bot_count: number;
  active_bot_channels: number;
  ai_requests_30d: number;
  conversations_30d: number;
  operations_summary: PlatformOperationsSummary;
  errors: {
    count: number;
    items: unknown[];
  };
};

export type PlatformHealthGate = {
  key: string;
  title?: string;
  status: "pass" | "warn" | "fail" | string;
  severity?: string;
  detail: string;
  action: string;
};

export type PlatformProviderRolloutCheck = {
  provider: string;
  title: string;
  order: number;
  enabled: boolean;
  status: "ready" | "warning" | "blocked" | string;
  gates: PlatformHealthGate[];
};

export type PlatformOperationsHealth = {
  environment: string;
  release: string;
  generated_at: string;
  status: "healthy" | "warning" | "critical" | string;
  summary: {
    critical: number;
    warning: number;
    active_support_grants: number;
    connector_requests: number;
  };
  runtime: {
    queue: {
      broker_configured: boolean;
      automation_inline: boolean;
      default_queue: string;
      queues: string[];
      status: "healthy" | "warning" | "critical" | string;
      automation_runs: {
        pending: number;
        running: number;
        failed: number;
      };
      failed_connector_syncs: number;
      failed_webhook_deliveries: number;
    };
    production_readiness: {
      summary: Record<string, number>;
      failed_items: PlatformHealthGate[];
      warning_items: PlatformHealthGate[];
    };
    backup_readiness: {
      summary: Record<string, number>;
      failed_items: PlatformHealthGate[];
    };
    provider_rollout: {
      summary: Record<string, number>;
      providers: PlatformProviderRolloutCheck[];
    };
  };
  work_queue: {
    connector_requests: Array<{
      id: Id;
      business_id: Id;
      business_name: string;
      provider: string;
      name: string;
      status: string;
      last_error: string;
      updated_at: string;
      created_by_email: string | null;
    }>;
    failed_automation_runs: Array<{
      id: Id;
      business_id: Id;
      business_name: string;
      trigger_type: string;
      entity_type: string;
      entity_id: string;
      status: string;
      attempts: number;
      max_attempts: number;
      error: string;
      created_at: string;
    }>;
    failed_integration_events: Array<{
      id: Id;
      business_id: Id | null;
      business_name: string;
      provider: string;
      channel: string;
      direction: string;
      status: string;
      error: string;
      created_at: string;
    }>;
    failed_webhook_deliveries: Array<{
      id: Id;
      business_id: Id;
      business_name: string;
      endpoint_name: string;
      event_type: string;
      status: string;
      attempts: number;
      error: string;
      created_at: string;
    }>;
  };
};

export type PlatformMerchant = {
  id: Id;
  name: string;
  status: Business["status"];
  created_at?: string;
  latest_activity_at?: string;
  landing_id?: string;
  landing_domain?: string;
  owner: Pick<User, "id" | "email" | "full_name">;
  plan: Pick<SubscriptionPlan, "id" | "name" | "code" | "monthly_price"> | null;
  subscription_status: Subscription["status"] | null;
  usage_summary: UsageSummaryItem[];
  operations?: PlatformMerchantOperations;
  health?: PlatformMerchantHealth;
  support_workflow?: PlatformSupportWorkflow;
};

export type Bot = {
  id: Id;
  business: Id;
  name: string;
  status: "draft" | "active" | "paused";
  default_language: string;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BotChannel = {
  id: Id;
  bot: Id;
  channel: "website" | "telegram" | "whatsapp" | "instagram";
  status: "draft" | "active" | "paused" | "error";
  external_id: string;
  public_token: string;
  config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type IntegrationEventLog = {
  id: Id;
  business: Id | null;
  business_name?: string | null;
  provider: "website" | "telegram" | "whatsapp" | "instagram" | "email" | string;
  channel: string;
  direction: "inbound" | "outbound";
  payload_json: Record<string, unknown>;
  status: "received" | "processed" | "sent" | "mocked" | "failed";
  error: string;
  created_at: string;
};

export type ApiToken = {
  id: Id;
  business: Id;
  name: string;
  token_prefix: string;
  scopes_json: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_by: Id | null;
  created_by_email?: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiTokenCreateResponse = ApiToken & {
  token: string;
};

export type WebhookEndpoint = {
  id: Id;
  business: Id;
  name: string;
  url: string;
  events_json: string[];
  is_active: boolean;
  created_by: Id | null;
  created_by_email?: string | null;
  created_at: string;
  updated_at: string;
};

export type WebhookDeliveryLog = {
  id: Id;
  business: Id;
  endpoint: Id;
  endpoint_name?: string;
  event_type: string;
  idempotency_key: string;
  payload_json: Record<string, unknown>;
  response_status: number | null;
  response_body: string;
  status: "pending" | "sent" | "failed";
  error: string;
  attempts: number;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type BusinessConnector = {
  id: Id;
  business: Id;
  business_name?: string;
  provider: "website" | "telegram" | "whatsapp" | "instagram" | "email" | "kaspi" | "1c" | "google_calendar" | "excel_csv" | "google_sheets" | "moysklad" | "wildberries" | "ozon" | "yandex_market" | "custom" | string;
  capability: "communications" | "sales" | "calendar" | "finance" | "inventory" | "marketing" | "custom" | string;
  name: string;
  status: "draft" | "connected" | "pending_request" | "setup_required" | "provider_configuring" | "error" | "disconnected" | "needs_attention" | "syncing" | "failed" | "disabled" | "expired_credentials";
  auth_type: "none" | "token" | "oauth" | "qr" | "login" | "connector";
  config_json: Record<string, unknown>;
  scopes_json: string[];
  last_sync_at: string | null;
  next_sync_at: string | null;
  last_error: string;
  connected_at: string | null;
  created_by: Id | null;
  created_by_email?: string | null;
  credentials_count?: number;
  created_at: string;
  updated_at: string;
};

export type ConnectorCapability = {
  provider: BusinessConnector["provider"];
  label: string;
  capability: BusinessConnector["capability"];
  auth_type: BusinessConnector["auth_type"];
  description: string;
  launch_status: "available" | "beta" | "soon" | "request" | "roadmap" | string;
  cta_label: string;
  next_step: string;
  pilot_note: string;
  setup_priority: number;
  is_pilot_safe: boolean;
  availability: "included" | "upgrade" | "request" | "soon" | "roadmap" | string;
  required_plan: "basic" | "business" | "pro" | string;
  setup_state: "active" | "setup_required" | "request_required" | "coming_soon" | "roadmap" | string;
  action_behavior: "self_service" | "request" | "disabled" | string;
  primary_action_label: string;
};

export type ConnectorCredential = {
  id: Id;
  business: Id;
  connector: Id;
  connector_name?: string;
  provider?: string;
  key: string;
  masked_value: string;
  expires_at: string | null;
  rotated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessEvent = {
  id: Id;
  business: Id;
  connector: Id | null;
  connector_name?: string | null;
  event_type: string;
  source: string;
  external_id: string;
  deduplication_key: string;
  occurred_at: string;
  processed_at: string | null;
  payload_json: Record<string, unknown>;
  status: "received" | "processed" | "failed" | "ignored";
  error: string;
  created_at: string;
};

export type ConnectorSyncRun = {
  id: Id;
  business: Id;
  connector: Id;
  connector_name?: string;
  mode: "webhook" | "pull" | "manual" | "healthcheck";
  status: "queued" | "running" | "succeeded" | "failed";
  started_at: string | null;
  finished_at: string | null;
  events_received: number;
  events_processed: number;
  error: string;
  created_at: string;
};

export type BotConversation = {
  id: Id;
  business: Id;
  business_name?: string;
  bot: Id;
  bot_name?: string;
  public_id: string;
  channel: "website" | "telegram" | "whatsapp" | "instagram";
  external_user_id: string;
  external_thread_id?: string;
  client: Id | null;
  client_name?: string;
  client_phone?: string;
  lead: Id | null;
  deal?: Id | null;
  assigned_to?: Id | null;
  assigned_to_email?: string;
  status: "open" | "closed" | "archived";
  priority?: "low" | "normal" | "high" | "urgent";
  bot_enabled?: boolean;
  handoff_required?: boolean;
  handoff_reason?: string;
  last_message_at?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  unread_count?: number;
  metadata_json?: Record<string, unknown>;
  last_message?: {
    id: Id;
    direction: "inbound" | "outbound";
    sender_type: "client" | "bot" | "manager" | "system" | "ai";
    text: string;
    status: "received" | "queued" | "sent" | "failed";
    created_at: string;
  } | null;
  attachments?: FileAttachment[];
  created_at: string;
  updated_at: string;
};

export type BotMessage = {
  id: Id;
  conversation: Id;
  direction: "inbound" | "outbound";
  sender_type: "client" | "bot" | "manager" | "system" | "ai";
  text: string;
  external_message_id?: string;
  payload_json: Record<string, unknown>;
  error_text?: string;
  status: "received" | "queued" | "sent" | "failed";
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  created_at: string;
  attachments?: FileAttachment[];
};

export type FileAttachment = {
  id: Id;
  business: Id;
  uploaded_by: Id | null;
  uploaded_by_email?: string | null;
  original_name: string;
  content_type: string;
  size: number;
  entity_type: string;
  entity_id: string;
  visibility: "private";
  download_url: string;
  created_at: string;
};

export type CurrentUser = User & {
  businesses: Business[];
  memberships?: BusinessMembershipSummary[];
  effective_permissions?: Record<string, EffectivePermission[]>;
  preferences?: UserPreference;
  social_identities?: SocialIdentitySummary[];
  is_platform_user: boolean;
  is_merchant_user: boolean;
  is_business_manager: boolean;
};

export type UserPreference = {
  language: "ru" | "kk" | "en";
  timezone: string;
  start_page: "dashboard" | "conversations" | "tasks" | "calendar" | "leads";
  created_at?: string;
  updated_at?: string;
};

export type SocialIdentitySummary = {
  provider: "google" | "apple";
  email: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type EffectivePermission = {
  resource: string;
  action: string;
  scope: "none" | "own" | "team" | "business";
};

export type BusinessMembershipSummary = {
  business: Id;
  role: "owner" | "admin" | "manager" | "operator" | "marketer" | "accountant" | "support" | "staff";
  business_role: Id | null;
  business_role_name: string;
  is_active: boolean;
};

export type BusinessRole = {
  id: Id;
  business: Id;
  name: string;
  preset_key: string;
  description: string;
  permissions_json: Record<string, unknown>;
  is_system: boolean;
  is_active: boolean;
  permissions: RolePermission[];
  created_at: string;
  updated_at: string;
};

export type RolePermission = {
  id: Id;
  business_role: Id;
  resource: string;
  action: string;
  scope: "none" | "own" | "team" | "business";
  is_allowed: boolean;
  created_at: string;
  updated_at: string;
};

export type TeamDepartment = {
  id: Id;
  business: Id;
  name: string;
  description: string;
  is_active: boolean;
  members_count?: number;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: Id;
  business: Id;
  user: User;
  role: BusinessMembershipSummary["role"];
  business_role: Id | null;
  business_role_name?: string;
  teams?: { id: Id; name: string; is_lead: boolean }[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessInvitation = {
  id: Id;
  business: Id;
  business_name?: string;
  email: string;
  phone: string;
  telegram: string;
  full_name: string;
  role: BusinessMembershipSummary["role"];
  business_role: Id | null;
  business_role_name?: string | null;
  invited_by: Id | null;
  invited_by_email?: string | null;
  delivery_channel: "email" | "whatsapp" | "telegram" | "manual";
  token: string;
  invite_path: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: Id;
  business: Id;
  full_name: string;
  phone: string;
  email: string;
  whatsapp_id: string;
  telegram_id: string;
  instagram_id: string;
  source: "website" | "telegram" | "whatsapp" | "instagram" | "manual" | "parser" | "other";
  notes: string;
  is_archived?: boolean;
  archived_at?: string | null;
  archived_by?: Id | null;
  archive_reason?: string;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: Id;
  business: Id;
  name: string;
  description: string;
  duration_minutes: number;
  price_from: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: Id;
  business: Id;
  client: Id;
  service: Id | null;
  source: Client["source"] | "landing";
  message: string;
  status: "new" | "in_progress" | "appointment_created" | "contacted" | "closed" | "lost";
  previous_status?: string;
  lost_reason?: string;
  lost_at?: string | null;
  lost_by?: Id | null;
  responsible_user: Id | null;
  is_archived?: boolean;
  archived_at?: string | null;
  archived_by?: Id | null;
  archive_reason?: string;
  created_at: string;
  updated_at: string;
};

export type Pipeline = {
  id: Id;
  business: Id;
  name: string;
  slug: string;
  entity_type: "deal";
  is_default: boolean;
  template_key: string;
  stages?: PipelineStage[];
  created_at: string;
  updated_at: string;
};

export type PipelineStage = {
  id: Id;
  business: Id;
  pipeline: Id;
  name: string;
  order: number;
  color: string;
  probability: number;
  sla_minutes: number | null;
  required_fields_json?: { fields?: string[] } & Record<string, unknown>;
  allowed_roles_json?: { roles?: string[] } & Record<string, unknown>;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
  updated_at: string;
};

export type Deal = {
  id: Id;
  business: Id;
  client: Id;
  lead: Id | null;
  pipeline: Id;
  stage: Id;
  title: string;
  amount: string;
  currency: string;
  probability: number;
  expected_close_at: string | null;
  owner: Id | null;
  status: "open" | "won" | "lost";
  source: string;
  lost_reason?: string;
  lost_by?: Id | null;
  previous_status?: string;
  previous_stage?: Id | null;
  won_at?: string | null;
  lost_at?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  archived_by?: Id | null;
  archive_reason?: string;
  stage_entered_at?: string | null;
  next_action_at?: string | null;
  sla_overdue?: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Resource = {
  id: Id;
  business: Id;
  name: string;
  resource_type: "staff" | "room" | "hall" | "box" | "equipment" | "other";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkingHours = {
  id: Id;
  business: Id;
  resource: Id | null;
  weekday: number;
  start_time: string;
  end_time: string;
  is_day_off: boolean;
};

export type Appointment = {
  id: Id;
  business: Id;
  client: Id;
  lead: Id | null;
  service: Id;
  resource: Id | null;
  start_at: string;
  end_at: string;
  status: "created" | "confirmed" | "cancelled" | "rescheduled" | "completed" | "no_show";
  source: "website" | "telegram" | "whatsapp" | "instagram" | "manual" | "bot";
  notes: string;
  is_archived?: boolean;
  archived_at?: string | null;
  archived_by?: Id | null;
  archive_reason?: string;
  created_at: string;
  updated_at: string;
};

export type AppointmentMessageSetting = {
  id: Id;
  business: Id;
  scenario: "confirmation" | "reminder" | "thank_you";
  label: string;
  is_enabled: boolean;
  offset_minutes: number;
  channel_policy: "auto" | "telegram" | "whatsapp" | "email" | "sms" | "system";
  template_text: string;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: Id;
  business: Id;
  client: Id;
  channel: "telegram" | "whatsapp" | "instagram" | "website" | "manual";
  external_chat_id: string;
  status: "open" | "closed" | "archived";
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: Id;
  conversation: Id;
  sender_type: "client" | "bot" | "manager" | "system";
  text: string;
  raw_payload: Record<string, unknown>;
  created_at: string;
};

export type QuickReplyTemplate = {
  id: Id;
  business: Id;
  title: string;
  text: string;
  category: string;
  channel: "all" | "telegram" | "whatsapp" | "instagram" | "website" | "manual";
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: Id;
  business: Id;
  recipient: Id | null;
  recipient_email?: string | null;
  recipient_name?: string | null;
  client: Id | null;
  client_name?: string | null;
  appointment: Id | null;
  channel: "telegram" | "whatsapp" | "email" | "sms" | "system";
  category: "sales" | "finance" | "system" | "ai_alerts" | "outreach" | "tasks";
  priority: "low" | "normal" | "high" | "urgent";
  text: string;
  send_at: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  action_url: string;
  action_label: string;
  read_at: string | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationPreference = {
  id: Id;
  business: Id;
  user: Id;
  user_email?: string | null;
  user_name?: string | null;
  category: Notification["category"];
  in_app_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type OutreachTemplate = {
  id: Id;
  business: Id;
  name: string;
  channel: "telegram" | "whatsapp";
  body: string;
  external_template_name: string;
  language_code: string;
  is_approved: boolean;
  is_active: boolean;
  created_by: Id | null;
  created_at: string;
  updated_at: string;
};

export type OutreachCampaign = {
  id: Id;
  business: Id;
  name: string;
  channel: "telegram" | "whatsapp";
  status: "draft" | "ready" | "scheduled" | "running" | "sent" | "cancelled";
  campaign_type: "service" | "marketing" | "transactional";
  audience_type: "all_clients" | "segment" | "manual";
  segment: Id | null;
  template: Id | null;
  message_text: string;
  require_opt_in: boolean;
  whatsapp_template_name: string;
  whatsapp_template_language: string;
  whatsapp_template_status: "not_required" | "draft" | "pending" | "approved" | "rejected";
  rate_limit_per_minute: number;
  batch_size: number;
  scheduled_at: string | null;
  created_by: Id | null;
  started_at: string | null;
  finished_at: string | null;
  recipients_total?: number;
  recipients_pending?: number;
  recipients_sent?: number;
  recipients_failed?: number;
  recipients_skipped?: number;
  created_at: string;
  updated_at: string;
};

export type OutreachRecipient = {
  id: Id;
  campaign: Id;
  business: Id;
  client: Id;
  client_name?: string;
  client_phone?: string;
  notification: Id | null;
  notification_status?: Notification["status"];
  status: "queued" | "pending" | "sent" | "failed" | "skipped" | "cancelled";
  recipient_id: string;
  personalized_text: string;
  error: string;
  error_code: string;
  provider_result: Record<string, unknown>;
  skipped_reason: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OutreachConsent = {
  id: Id;
  business: Id;
  client: Id;
  client_name?: string;
  client_phone?: string;
  channel: "telegram" | "whatsapp";
  status: "opted_in" | "opted_out" | "unknown";
  source: string;
  note: string;
  evidence_json: Record<string, unknown>;
  opted_in_at: string | null;
  opted_out_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AnalyticsEvent = {
  id: Id;
  business: Id;
  client: Id | null;
  event_type: string;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ReportWidget = {
  id: Id;
  business: Id;
  key: string;
  title: string;
  widget_type: "kpi" | "table" | "funnel" | "list";
  config_json: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ScheduledReport = {
  id: Id;
  business: Id;
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  recipients_json: string[];
  report_config_json: Record<string, unknown>;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_by: Id | null;
  created_by_email?: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentProfile = {
  id: Id;
  business: Id;
  bot: Id | null;
  bot_name?: string | null;
  name: string;
  role_description: string;
  tone: "friendly" | "expert" | "formal" | "sales" | "support";
  language: string;
  is_active: boolean;
  system_prompt: string;
  rules_json: Record<string, unknown>;
  allowed_tools_json: Record<string, unknown>;
  escalation_rules_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BusinessKnowledgeItem = {
  id: Id;
  business: Id;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ActivityEvent = {
  id: Id;
  business: Id;
  client: Id | null;
  actor: Id | null;
  category: "crm" | "message" | "appointment" | "task" | "automation" | "system";
  event_type: string;
  source: string;
  entity_type: string;
  entity_id: string;
  text: string;
  metadata: Record<string, unknown>;
  created_at: string;
};


export type AIToolCallLog = {
  id: Id;
  business: Id;
  user: Id | null;
  conversation: Id | null;
  tool_name: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  status: "suggested" | "executed" | "failed" | "rejected";
  error: string;
  created_at: string;
};

export type AIToolDefinition = {
  name: string;
  description: string;
  requires_confirmation: boolean;
};

export type AIToolSuggestResponse = {
  tools: AIToolDefinition[];
  suggested_actions: AIToolCallLog[];
};

export type Task = {
  id: Id;
  business: Id;
  title: string;
  description: string;
  client: Id | null;
  lead: Id | null;
  deal: Id | null;
  appointment: Id | null;
  parent_task: Id | null;
  assignee: Id | null;
  created_by: Id | null;
  watchers: Id[];
  due_at: string | null;
  reminder_at: string | null;
  snoozed_until: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "cancelled";
  recurrence_rule: string;
  completed_at: string | null;
  completed_by: Id | null;
  comments_count?: number;
  watchers_count?: number;
  is_archived?: boolean;
  archived_at?: string | null;
  archived_by?: Id | null;
  archive_reason?: string;
  created_at: string;
  updated_at: string;
};

export type TaskComment = {
  id: Id;
  task: Id;
  author: Id | null;
  author_name?: string | null;
  author_email?: string | null;
  text: string;
  created_at: string;
};

export type Note = {
  id: Id;
  business: Id;
  client: Id | null;
  author: Id | null;
  entity_type: string;
  entity_id: string;
  text: string;
  created_at: string;
  updated_at: string;
};

export type CrmEntityType = "client" | "lead" | "deal" | "appointment";

export type Tag = {
  id: Id;
  business: Id;
  name: string;
  color: string;
  source: "manual" | "ai" | "behavior" | "automation";
  created_at: string;
  updated_at: string;
};

export type TaggedObject = {
  id: Id;
  business: Id;
  tag: Id;
  tag_name?: string;
  tag_color?: string;
  entity_type: CrmEntityType | string;
  entity_id: string;
  created_at: string;
};

export type SegmentFilter = {
  id: Id;
  business: Id;
  segment: Id;
  field: "full_name" | "phone" | "email" | "source" | "notes" | "tag" | "created_at";
  operator: "equals" | "contains" | "in" | "gte" | "lte" | "is_empty" | "not_empty";
  value_json: { value?: unknown; values?: unknown[] } & Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Segment = {
  id: Id;
  business: Id;
  name: string;
  description: string;
  entity_type: "client";
  is_active: boolean;
  cached_count: number;
  last_evaluated_at: string | null;
  filters: SegmentFilter[];
  created_at: string;
  updated_at: string;
};

export type CrmCardPayload = {
  client: Client | null;
  lead: Lead | null;
  deal: Deal | null;
  appointment: Appointment | null;
  leads: Lead[];
  deals: Deal[];
  appointments: Appointment[];
  tasks: Task[];
  conversations: BotConversation[];
  timeline: ActivityEvent[];
  notes: Note[];
  tags: TaggedObject[];
  attachments: FileAttachment[];
  custom_fields: CrmCardCustomField[];
};

export type DuplicateClient = {
  id: Id;
  full_name: string;
  phone: string;
  email: string;
  matched_fields: string[];
};

export type DuplicateCheckResponse = {
  duplicates: DuplicateClient[];
};

export type LeadDuplicateCheckResponse = DuplicateCheckResponse & {
  related_leads: Array<{
    id: Id;
    client: Id;
    status: Lead["status"];
    source: Lead["source"];
    message: string;
  }>;
};

export type CustomFieldDefinition = {
  id: Id;
  business: Id;
  entity_type: CrmEntityType;
  key: string;
  label: string;
  field_type:
    | "text"
    | "textarea"
    | "number"
    | "money"
    | "date"
    | "datetime"
    | "select"
    | "multiselect"
    | "boolean"
    | "phone"
    | "email"
    | "url";
  options_json: { options?: string[] } & Record<string, unknown>;
  permissions_json: { view_roles?: string[]; edit_roles?: string[] } & Record<string, unknown>;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CustomFieldValue = {
  id: Id;
  business: Id;
  definition: Id;
  entity_type: CrmEntityType;
  entity_id: string;
  value_json: { value?: unknown } & Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CrmCardCustomField = {
  definition: CustomFieldDefinition;
  value: CustomFieldValue | null;
};

export type AutomationRule = {
  id: Id;
  business: Id;
  name: string;
  trigger_type: string;
  description: string;
  is_active: boolean;
  priority: number;
  conditions?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
};

export type AutomationTemplate = {
  key: string;
  name: string;
  description: string;
  trigger_type: string;
  actions: Array<Record<string, unknown>>;
  conditions?: Array<Record<string, unknown>>;
};

export type AutomationRun = {
  id: Id;
  business: Id;
  rule: Id | null;
  trigger_type: string;
  entity_type: string;
  entity_id: string;
  idempotency_key?: string | null;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  payload: Record<string, unknown>;
  action_results?: Array<Record<string, unknown>>;
  error: string;
  attempts?: number;
  max_attempts?: number;
  run_after?: string | null;
  next_retry_at?: string | null;
  locked_at?: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type AutomationConditionDraft = {
  field: string;
  operator: "eq" | "gt" | "lt" | "contains" | "in";
  value: Record<string, unknown>;
};

export type AutomationActionDraft = {
  action_type: "create_task" | "create_notification" | "wait";
  config: Record<string, unknown>;
  delay_seconds: number;
};

export type ManualAutomationRulePayload = {
  business: Id;
  name: string;
  trigger_type: string;
  description?: string;
  is_active?: boolean;
  priority?: number;
  conditions: AutomationConditionDraft[];
  actions: AutomationActionDraft[];
};

export type AutomationPreview = {
  valid: boolean;
  name: string;
  trigger_type: string;
  trigger_label: string;
  conditions_count: number;
  actions_count: number;
  will_run_when: string;
  steps: AutomationActionDraft[];
};

export type AvailableSlot = {
  start_at: string;
  end_at: string;
};

export type OwnerDashboardMetrics = {
  business: Id;
  new_leads: number;
  total_leads: number;
  leads_by_source: Array<{ source: string; count: number }>;
  appointments_today: number;
  appointments_completed: number;
  no_show_count: number;
  conversion_lead_to_appointment: number;
  open_tasks: number;
  overdue_tasks: number;
  manager_response_time: number | null;
  revenue_estimate: string;
  sales_events_count?: number;
  revenue?: {
    today: string;
    yesterday: string;
    total_estimate: string;
    growth_percent: number | null;
  };
  business_pulse?: {
    tone: "setup" | "warning" | "attention" | "growth";
    title: string;
    text: string;
    primary_action?: { label: string; href: string };
  };
  recommendations?: Array<{
    key: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    action_label: string;
    href: string;
  }>;
  quick_connect?: Array<{
    key: string;
    title: string;
    description: string;
    status: "connected" | "connect" | "beta" | "soon" | "request";
    href: string;
  }>;
  setup?: {
    score: number;
    sources: Record<string, boolean>;
  };
  data_quality?: {
    has_sales_data: boolean;
    sales_events_count: number;
    recommendation: string;
  };
  connector_health?: {
    connected: number;
    pending: number;
    error: number;
    total: number;
  };
  latest_business_events?: Array<{
    id: Id;
    event_type: string;
    source: string;
    connector: string;
    occurred_at: string;
    status: string;
    amount: string;
  }>;
  attention_items?: Array<{
    key: "new_leads" | "overdue_tasks" | "connector_errors" | "connector_pending" | "sales_data" | string;
    count: number;
    tone: "warning" | "danger" | "info" | string;
    href: string;
  }>;
  mobile_onboarding?: {
    headline: string;
    subtext: string;
    score: number;
    primary_action: { label: string; href: string };
    next_step_key: string;
    steps: Array<{
      key: string;
      title: string;
      description: string;
      status: "done" | "todo";
      href: string;
      cta: string;
      priority: number;
    }>;
  };
};

export type TeamPerformanceMember = {
  user: { id: Id; email: string; full_name: string };
  role: string;
  teams: Array<{ id: Id; name: string; is_lead: boolean }>;
  assigned_leads: number;
  contacted_leads: number;
  closed_leads: number;
  lost_leads: number;
  lost_without_reason: number;
  lost_reason_breakdown: Array<{ lost_reason: string; count: number }>;
  overdue_handoffs: number;
  missed_chat_handoffs: number;
  avg_response_time_minutes: number | null;
  appointments_created: number;
  appointment_conversion_rate: number;
  lost_rate: number;
  no_show_appointments: number;
  deals_won: number;
  deals_lost: number;
  sla_overdue_deals: number;
  tasks_overdue: number;
  tasks_completed: number;
  action_items: TeamPerformanceActionItem[];
};

export type TeamPerformanceWarning = {
  type: string;
  severity: "warning" | "critical" | "info";
  user_id: Id;
  message: string;
  count: number;
};

export type TeamPerformanceActionItem = {
  type: string;
  severity: "warning" | "critical" | "info";
  user_id: Id;
  title: string;
  description: string;
  route: string;
  count: number;
};

export type TeamPerformanceTeam = {
  id: Id;
  name: string;
  members_count: number;
  assigned_leads: number;
  lost_leads: number;
  overdue_handoffs: number;
  missed_chat_handoffs: number;
  tasks_overdue: number;
  sla_overdue_deals: number;
  deals_won: number;
  deals_lost: number;
  no_show_appointments: number;
  lost_rate: number;
};

export type TeamPerformanceMetrics = {
  business: Id;
  scope: "business" | "team" | "own";
  totals: {
    assigned_leads: number;
    contacted_leads: number;
    closed_leads: number;
    lost_leads: number;
    overdue_handoffs: number;
    missed_chat_handoffs: number;
    tasks_overdue: number;
    deals_won: number;
    deals_lost: number;
    sla_overdue_deals: number;
    no_show_appointments: number;
    appointment_conversion_rate: number;
    lost_rate: number;
  };
  members: TeamPerformanceMember[];
  teams: TeamPerformanceTeam[];
  warnings: TeamPerformanceWarning[];
  action_items: TeamPerformanceActionItem[];
};

export type AnalyticsReportSummary = {
  business: Id;
  period: { start: string | null; end: string | null };
  widgets: Array<Pick<ReportWidget, "id" | "key" | "title" | "widget_type" | "config_json" | "sort_order">>;
  source_roi: Array<{
    source: string;
    leads: number;
    appointments: number;
    completed_appointments: number;
    revenue_estimate: string;
    conversion_rate: number;
    roi_status: string;
  }>;
  funnel_velocity: {
    lead_statuses: Array<{ status: Lead["status"]; count: number }>;
    deal_stages: Array<{ stage: string; count: number; avg_probability: number; avg_days_in_stage: number | null }>;
    open_deals: number;
    won_deals: number;
    lost_deals: number;
    velocity_note: string;
  };
  manager_performance: Array<{
    user_id: Id;
    email: string;
    full_name: string;
    assigned_leads: number;
    appointment_leads: number;
    lost_leads: number;
    won_deals: number;
    lost_deals: number;
    open_tasks: number;
  }>;
  retention_ltv: {
    total_clients: number;
    repeat_clients: number;
    repeat_rate: number;
    ltv_estimate: string;
    data_quality: string;
  };
};

export type ImportJob = {
  id: Id;
  business: Id;
  actor: Id | null;
  actor_email?: string;
  entity_type: "clients" | "leads" | "deals" | "sales" | "catalog";
  source_file: string;
  original_filename: string;
  status: "uploaded" | "previewed" | "imported" | "failed" | "cancelled";
  mapping_json: Record<string, string>;
  preview_json: {
    headers?: string[];
    rows?: Array<Record<string, string>>;
    import_summary?: ImportSummary;
  };
  duplicates_json: {
    rows?: Array<{
      row: number;
      payload: Record<string, string>;
      duplicates: Array<{ id: Id; full_name: string; phone?: string; email?: string; matched_fields: string[] }>;
    }>;
  };
  errors_json?: {
    rows?: Array<{
      row: number;
      field: string;
      message: string;
    }>;
  };
  total_rows: number;
  imported_count: number;
  summary_json?: ImportSummary;
  error: string;
  created_at: string;
  updated_at: string;
  imported_at?: string | null;
};

export type ImportSummary = {
  total_rows?: number;
  preview_rows?: number;
  errors?: number;
  duplicates?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  imported?: number;
  ready?: boolean;
  status?: string;
};

export type LeadFormField = {
  id: Id;
  form: Id;
  label: string;
  key: string;
  field_type: "text" | "textarea" | "phone" | "email" | "select";
  placeholder: string;
  options_json: Record<string, unknown>;
  is_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LeadCaptureForm = {
  id: Id;
  business: Id;
  name: string;
  public_id: string;
  landing_id?: string;
  landing_domain?: string;
  preview_url?: string;
  title: string;
  description: string;
  source: Lead["source"];
  success_message: string;
  default_responsible_user: Id | null;
  is_active: boolean;
  fields: LeadFormField[];
  submissions_count?: number;
  created_at: string;
  updated_at: string;
};

export type LeadFormSubmission = {
  id: Id;
  form: Id;
  form_name?: string;
  business: Id;
  client: Id | null;
  lead: Id | null;
  payload_json: Record<string, unknown>;
  utm_json: Record<string, unknown>;
  source_context_json?: Record<string, unknown>;
  duplicate_json: Record<string, unknown>;
  landing_id?: string;
  page_url?: string;
  page_domain?: string;
  ip_address?: string | null;
  user_agent: string;
  created_at: string;
};

export type AuditLog = {
  id: Id;
  business: Id | null;
  business_name?: string;
  actor: Id | null;
  actor_email?: string;
  action: "create" | "update" | "delete" | "support_access";
  category: "data" | "access" | "security" | "system" | "integration";
  risk_level: "low" | "medium" | "high" | "critical";
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
};

export type LoginHistory = {
  id: Id;
  business: Id | null;
  business_name?: string;
  user: Id | null;
  user_email?: string;
  email: string;
  status: "success" | "failed";
  ip_address: string | null;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SupportAccessGrant = {
  id: Id;
  business: Id;
  user: Id;
  user_email?: string;
  reason: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  created_by: Id | null;
  created_by_email?: string;
  is_valid_now?: boolean;
};

export type SecurityRiskSummary = {
  business: Id;
  risk_counts: Record<"low" | "medium" | "high" | "critical", number>;
  failed_logins: number;
  active_support_grants: number;
};
