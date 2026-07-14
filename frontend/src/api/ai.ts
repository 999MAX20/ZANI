import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { AgentProfile, AIToolCallLog, AIToolSuggestResponse, BusinessKnowledgeItem, Id } from "../types";

export type AIAssistantChatResponse = {
  answer: string;
  is_mock: boolean;
  provider: string;
  model: string;
  tokens_used: number;
  log_id: Id;
  context: {
    clients_count: number;
    new_leads_count: number;
    open_appointments_count: number;
  };
};

export type AIAssistantStatusResponse = {
  enabled: boolean;
  provider: string;
  mode: "mock" | "live";
  ready: boolean;
  key_configured: boolean;
  model: string;
  fast_model: string;
  cheap_model: string;
};

export type PublicLandingAssistantResponse = {
  answer: string;
  is_mock: boolean;
  provider: string;
  model: string;
  tokens_used: number;
};

export type AIAnalystSource = {
  id: string;
  event_id: Id;
  label: string;
  source: string;
  event_type: string;
  status: string;
  occurred_at: string;
  connector: string | null;
  external_id: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type AIAnalystInsight = {
  id: string;
  severity: "critical" | "warning" | "info" | "good";
  title: string;
  summary: string;
  source_ids: string[];
};

export type AIAnalystAction = {
  id: string;
  priority: "high" | "medium" | "low";
  label: string;
  description: string;
  href: string;
  source_ids: string[];
};

export type AIAnalystBriefResponse = {
  generated_at: string;
  is_mock: boolean;
  provider: string;
  model: string;
  tokens_used: number;
  log_id: Id;
  sources: AIAnalystSource[];
  insights: AIAnalystInsight[];
  actions: AIAnalystAction[];
  raw_answer: string;
};

export type AIOwnerBriefSource = {
  id: string;
  entity_type: string;
  entity_id: Id;
  label: string;
  summary: string;
  href: string;
  occurred_at: string | null;
  metadata: Record<string, unknown>;
};

export type AIOwnerBriefRecommendation = {
  id: string;
  category: "stale_leads" | "overdue_tasks" | "unanswered_conversations" | "stalled_deals" | "failed_connectors" | string;
  priority: "high" | "medium" | "low";
  label: string;
  description: string;
  href: string;
  source_ids: string[];
};

export type AIOwnerBriefSection = {
  id: string;
  count: number;
  source_ids: string[];
};

export type AIOwnerDailyBriefResponse = {
  generated_at: string;
  business: Id;
  is_mock: boolean;
  provider: string;
  model: string;
  summary: {
    attention_count: number;
    source_count: number;
    categories: Record<string, number>;
    no_data: boolean;
    no_data_reason: string;
  };
  sections: AIOwnerBriefSection[];
  recommendations: AIOwnerBriefRecommendation[];
  sources: AIOwnerBriefSource[];
};

export const aiApi = {
  publicLandingAssistant: async ({ message, section }: { message: string; section?: string }) => {
    const { data } = await apiClient.post<PublicLandingAssistantResponse>("/api/public/landing/assistant/", {
      message,
      section,
    });
    return data;
  },
  assistantStatus: async (business: Id) => {
    const { data } = await apiClient.get<AIAssistantStatusResponse>("/api/ai/assistant/status/", {
      params: { business },
    });
    return data;
  },
  assistantChat: async ({ business, message, prompt_type }: { business: Id; message: string; prompt_type?: string }) => {
    const { data } = await apiClient.post<AIAssistantChatResponse>("/api/ai/assistant/chat/", {
      business,
      message,
      prompt_type,
    });
    return data;
  },
  analystBrief: async ({ business, limit = 24 }: { business: Id; limit?: number }) => {
    const { data } = await apiClient.get<AIAnalystBriefResponse>("/api/ai/analyst/brief/", {
      params: { business, limit },
    });
    return data;
  },
  ownerDailyBrief: async ({ business, limit = 8 }: { business: Id; limit?: number }) => {
    const { data } = await apiClient.get<AIOwnerDailyBriefResponse>("/api/ai/owner-brief/daily/", {
      params: { business, limit },
    });
    return data;
  },
  suggestTools: async ({ business, message }: { business: Id; message: string }) => {
    const { data } = await apiClient.post<AIToolSuggestResponse>("/api/ai/tools/suggest/", { business, message });
    return data;
  },
  executeTool: async (logId: Id, approvalId?: Id) => {
    const { data } = await apiClient.post<AIToolCallLog>(`/api/ai/tools/${logId}/execute/`, approvalId ? { approval_id: approvalId } : {});
    return data;
  },
};

export type AgentProfilePayload = Omit<Partial<AgentProfile>, "rules_json" | "allowed_tools_json" | "escalation_rules_json"> & {
  rules_json?: Record<string, unknown>;
  allowed_tools_json?: Record<string, unknown>;
  escalation_rules_json?: Record<string, unknown>;
};

export const agentProfilesApi = createCrudApi<AgentProfile, AgentProfilePayload, AgentProfilePayload>("/api/ai/agent-profiles/");

export type BusinessKnowledgeItemPayload = Pick<BusinessKnowledgeItem, "business" | "title" | "content" | "category" | "is_active">;

export const businessKnowledgeApi = createCrudApi<
  BusinessKnowledgeItem,
  BusinessKnowledgeItemPayload,
  Partial<BusinessKnowledgeItemPayload>
>("/api/ai/knowledge-items/");
