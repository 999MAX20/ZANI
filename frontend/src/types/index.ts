export type Id = number;

export type User = {
  id: Id;
  email: string;
  full_name?: string;
  phone?: string;
  role?: "platform_admin" | "platform_manager" | "business_owner" | "business_manager" | "manager" | "staff";
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
  status: "active" | "inactive" | "trial" | "blocked";
  created_at: string;
  updated_at: string;
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
  started_at: string | null;
  next_payment_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UsageSummaryItem = {
  metric: "ai_requests" | "bot_messages" | "users" | "conversations";
  value: number;
  limit: number | null;
  is_limited: boolean;
  is_over_limit: boolean;
  period_start: string;
  period_end: string;
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
  errors: {
    count: number;
    items: unknown[];
  };
};

export type PlatformMerchant = {
  id: Id;
  name: string;
  status: Business["status"];
  created_at: string;
  owner: Pick<User, "id" | "email" | "full_name">;
  plan: Pick<SubscriptionPlan, "id" | "name" | "code" | "monthly_price"> | null;
  subscription_status: Subscription["status"] | null;
  usage_summary: UsageSummaryItem[];
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
};

export type CurrentUser = User & {
  businesses: Business[];
  is_platform_user: boolean;
  is_merchant_user: boolean;
  is_business_manager: boolean;
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
  source: Client["source"];
  message: string;
  status: "new" | "in_progress" | "appointment_created" | "contacted" | "closed" | "lost";
  responsible_user: Id | null;
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

export type Notification = {
  id: Id;
  business: Id;
  client: Id;
  appointment: Id | null;
  channel: "telegram" | "whatsapp" | "email" | "sms" | "system";
  text: string;
  send_at: string;
  status: "pending" | "sent" | "failed" | "cancelled";
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

export type Task = {
  id: Id;
  business: Id;
  title: string;
  description: string;
  client: Id | null;
  lead: Id | null;
  deal: Id | null;
  appointment: Id | null;
  assignee: Id | null;
  created_by: Id | null;
  due_at: string | null;
  reminder_at: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "cancelled";
  recurrence_rule: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
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
};

export type AutomationRule = {
  id: Id;
  business: Id;
  name: string;
  trigger_type: string;
  description: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type AvailableSlot = {
  start_at: string;
  end_at: string;
};
