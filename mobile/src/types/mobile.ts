export type AppLanguage = "ru" | "kk" | "en";

export type MobileBusiness = {
  id: number;
  name: string;
  slug: string;
  business_type: string;
  city: string;
  timezone: string;
  language: string;
  currency: string;
  status: string;
  permissions: Array<{
    resource: string;
    action: string;
    scope: string;
  }>;
};

export type MobileUser = {
  id: number;
  email: string;
  full_name?: string;
  role?: string;
};

export type MobileCompactUser = {
  id: number;
  email: string;
  full_name: string;
} | null;

export type MobileDevice = {
  id: number;
  business: number;
  platform: string;
  app_version: string;
  build_number: string;
  os_version: string;
  device_model: string;
  last_seen_at: string;
  revoked_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MobilePushToken = {
  id: number;
  business: number;
  device: number;
  provider: "expo" | "apns" | "fcm";
  is_active: boolean;
  last_seen_at: string;
  revoked_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MobileDevices = {
  business: number;
  generated_at: string;
  items: MobileDevice[];
};

export type MobileAuthResponse = {
  access: string;
  refresh: string;
  token_type: "Bearer";
  business: MobileBusiness;
  device: MobileDevice;
};

export type MobileVersionPolicy = {
  min_supported_version: string;
  latest_version: string;
  update_urls: {
    ios: string;
    android: string;
  };
};

export type MobileBootstrap = {
  api_version: string;
  server_time: string;
  user: MobileUser;
  active_business: MobileBusiness;
  businesses: MobileBusiness[];
  version_policy: MobileVersionPolicy;
  feature_flags: Record<string, boolean>;
  budgets: Record<string, number>;
};

export type MobileHomeItem = {
  id?: number;
  title?: string;
  status?: string;
  source?: string;
  href: string;
  created_at?: string;
  updated_at?: string;
  due_at?: string | null;
  start_at?: string;
  end_at?: string;
  phone?: string;
  email?: string;
  notes?: string;
  priority?: string;
  unread_count?: number;
  handoff_required?: boolean;
  client?: {
    id: number;
    name: string;
    phone: string;
    email: string;
  };
  service?: {
    id: number | null;
    name: string;
  };
  message?: string;
};

export type MobileHome = {
  business: number;
  generated_at: string;
  limit: number;
  sections: {
    leads?: {
      total: number;
      new: number;
      unassigned: number;
      latest: MobileHomeItem[];
    };
    tasks?: {
      open: number;
      overdue: number;
      today: number;
      next: MobileHomeItem[];
    };
    appointments?: {
      today: number;
      needs_confirmation: number;
      upcoming: MobileHomeItem[];
    };
    conversations?: {
      open: number;
      unread: number;
      handoff_required: number;
      latest: MobileHomeItem[];
    };
    deals?: {
      open: number;
      amount_open: string;
    };
    revenue?: {
      today: string;
      total_estimate: string;
      events: number;
    };
  };
  kpis: Array<{
    key: string;
    value: number | string;
    href: string;
  }>;
  attention: {
    total: number;
    items: Array<{
      key: string;
      type: string;
      count: number;
      priority: number;
      href: string;
    }>;
  };
  quick_actions: Array<{
    key: string;
    href: string;
  }>;
  payload_budget: {
    target_kb: number;
    max_items_per_section: number;
  };
};

export type MobileToday = {
  business: number;
  generated_at: string;
  date: string;
  limit: number;
  sections: {
    appointments?: {
      date: string;
      total: number;
      items: MobileHomeItem[];
    };
    tasks?: {
      date: string;
      total: number;
      overdue: number;
      items: MobileHomeItem[];
    };
  };
  payload_budget: {
    target_kb: number;
    max_items_per_section: number;
  };
};

export type MobileAction = {
  key: string;
  type: string;
  priority: number;
  entity: MobileHomeItem;
};

export type MobileActions = {
  business: number;
  generated_at: string;
  limit: number;
  total: number;
  items: MobileAction[];
  payload_budget: {
    target_kb: number;
    max_items: number;
  };
};

export type MobileInbox = {
  business: number;
  generated_at: string;
  limit: number;
  summary: {
    open: number;
    unread: number;
    handoff_required: number;
  };
  items: Array<MobileHomeItem & {
    channel?: string;
    last_message_preview?: {
      direction: string;
      sender_type: string;
      text: string;
      created_at: string | null;
    };
  }>;
  payload_budget: {
    target_kb: number;
    max_items: number;
  };
};

export type MobileLeads = {
  business: number;
  generated_at: string;
  limit: number;
  summary: {
    total: number;
    new: number;
    unassigned: number;
    in_progress: number;
  };
  items: MobileHomeItem[];
  payload_budget: {
    target_kb: number;
    max_items: number;
  };
};

export type MobileNotifications = {
  business: number;
  generated_at: string;
  limit: number;
  summary: {
    total: number;
    unread: number;
    urgent: number;
    failed: number;
  };
  items: Array<{
    id: number;
    category: string;
    priority: string;
    status: string;
    channel: string;
    text: string;
    action_url: string;
    action_label: string;
    send_at: string;
    read_at: string | null;
    client_id: number | null;
    appointment_id: number | null;
  }>;
  payload_budget: {
    target_kb: number;
    max_items: number;
  };
};

export type MobileNotificationPreference = {
  category: "sales" | "finance" | "system" | "ai_alerts" | "outreach" | "tasks";
  in_app_enabled: boolean;
  push_enabled: boolean;
  privacy_mode: "redacted" | "full";
};

export type MobileNotificationPreferences = {
  business: number;
  generated_at: string;
  items: MobileNotificationPreference[];
};

export type MobileNotificationMarkReadResponse = {
  ok: true;
  replayed: boolean;
  notification: MobileNotifications["items"][number];
};

export type MobileClients = {
  business: number;
  generated_at: string;
  limit: number;
  summary: {
    total: number;
    with_phone: number;
    with_email: number;
  };
  items: MobileHomeItem[];
  payload_budget: {
    target_kb: number;
    max_items: number;
  };
};

export type MobileTasks = {
  business: number;
  generated_at: string;
  limit: number;
  summary: {
    total: number;
    open: number;
    overdue: number;
    today: number;
  };
  items: MobileHomeItem[];
  payload_budget: {
    target_kb: number;
    max_items: number;
  };
};

export type MobileTaskCompleteResponse = {
  ok: true;
  replayed: boolean;
  task: MobileHomeItem;
};

export type MobileTaskWriteResponse = {
  ok: true;
  replayed: boolean;
  task: MobileHomeItem;
};

export type MobileLeadAssignResponse = {
  ok: true;
  replayed: boolean;
  lead: MobileHomeItem;
};

export type MobileLeadQualifyResponse = {
  ok: true;
  replayed: boolean;
  lead: MobileHomeItem;
};

export type MobileApprovalDecisionResponse = {
  ok: true;
  replayed: boolean;
  approval: MobileHomeItem;
};

export type MobileAppointments = {
  business: number;
  generated_at: string;
  limit: number;
  date: string;
  summary: {
    total: number;
    today: number;
    upcoming: number;
    needs_confirmation: number;
  };
  items: MobileHomeItem[];
  payload_budget: {
    target_kb: number;
    max_items: number;
  };
};

export type MobileAppointmentConfirmResponse = {
  ok: true;
  replayed: boolean;
  appointment: MobileHomeItem;
};

export type MobileAppointmentWriteResponse = {
  ok: true;
  replayed: boolean;
  appointment: MobileHomeItem;
};

export type MobileInboxReplyResponse = {
  ok: true;
  replayed: boolean;
  conversation: MobileHomeItem;
  message: {
    id: number;
    conversation_id: number;
    direction: string;
    sender_type: string;
    text: string;
    status: string;
    created_at: string;
    sent_at: string | null;
    error_text: string;
  };
};

export type MobileClientDetail = {
  business: number;
  generated_at: string;
  client: MobileHomeItem;
  details: {
    notes: string;
    normalized_phone: string;
    normalized_email: string;
    whatsapp_id: string;
    telegram_id: string;
    instagram_id: string;
  };
  related: {
    leads: MobileHomeItem[];
    tasks: MobileHomeItem[];
    appointments: MobileHomeItem[];
    conversations: MobileHomeItem[];
  };
  payload_budget: {
    target_kb: number;
    max_related_per_section: number;
  };
};

export type MobileLeadDetail = {
  business: number;
  generated_at: string;
  lead: MobileHomeItem;
  details: {
    message: string;
    lost_reason: string;
    lost_at: string | null;
    responsible_user_id: number | null;
    responsible_user: MobileCompactUser;
  };
  related: {
    tasks: MobileHomeItem[];
    appointments: MobileHomeItem[];
    conversations: MobileHomeItem[];
  };
  payload_budget: {
    target_kb: number;
    max_related_per_section: number;
  };
};

export type MobileTaskDetail = {
  business: number;
  generated_at: string;
  task: MobileHomeItem;
  details: {
    description: string;
    reminder_at: string | null;
    snoozed_until: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    cancel_reason: string;
    created_by: MobileCompactUser;
    assignee: MobileCompactUser;
    appointment_id: number | null;
  };
  comments: Array<{
    id: number;
    text: string;
    author: MobileCompactUser;
    created_at: string;
  }>;
  payload_budget: {
    target_kb: number;
    max_comments: number;
  };
};

export type MobileAppointmentDetail = {
  business: number;
  generated_at: string;
  appointment: MobileHomeItem;
  details: {
    notes: string;
    source: string;
    client: MobileHomeItem;
    service: {
      id: number | null;
      name: string;
      duration_minutes: number | null;
      price_from: string;
    };
    resource: {
      id: number | null;
      name: string;
      type: string;
    };
  };
  related: {
    tasks: MobileHomeItem[];
  };
  payload_budget: {
    target_kb: number;
    max_related_per_section: number;
  };
};

export type MobileConversationDetail = {
  business: number;
  generated_at: string;
  conversation: MobileHomeItem & {
    channel?: string;
    unread_count?: number;
    handoff_required?: boolean;
  };
  details: {
    status: string;
    priority: string;
    channel: string;
    bot_enabled: boolean;
    handoff_reason: string;
    client: MobileHomeItem | null;
    lead: MobileHomeItem | null;
    assigned_to: MobileCompactUser;
  };
  messages: MobileInboxReplyResponse["message"][];
  payload_budget: {
    target_kb: number;
    max_messages: number;
  };
};
