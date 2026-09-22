import { apiClient } from "./client";
import { isAxiosError } from "axios";
import { createCrudApi } from "./crud";
import type { AgentProfile, ApprovalRequest, AIToolCallLog, AIToolSuggestResponse, BusinessKnowledgeItem, Id } from "../types";
import { translate, getCurrentLanguage } from "../lib/i18n";

export type AIAssistantChatResponse = {
  sources: { id: string; label: string }[];
  provider_state: "live" | "mock" | "no_data";
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
  mode: "mock" | "live" | "unavailable";
  ready: boolean;
  key_configured: boolean;
  model: string;
  fast_model: string;
  cheap_model: string;
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
  provider_state: "live" | "mock" | "no_data" | "unavailable" | "invalid_response";
  generated_at: string;
  is_mock: boolean;
  provider: string;
  model: string;
  tokens_used: number;
  log_id: Id | null;
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

type AIJob = { id: Id; status: string; result_json: AIAssistantChatResponse };
const pendingChats = new Map<string, Id>();

async function getChatJob(id: Id, key: string): Promise<AIJob> {
  try {
    return (await apiClient.get<AIJob>(`/api/ai/jobs/${id}/`)).data;
  } catch (error) {
    if (isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0)) {
      pendingChats.delete(key);
    }
    throw error;
  }
}

async function waitForChat(job: AIJob, key: string): Promise<AIAssistantChatResponse> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (job.status === "succeeded") {
      pendingChats.delete(key);
      return job.result_json;
    }
    if (job.status === "failed") {
      pendingChats.delete(key);
      throw new Error(translate(getCurrentLanguage(), "aiQuality.unavailable"));
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    job = await getChatJob(job.id, key);
  }
  throw new Error(translate(getCurrentLanguage(), "aiQuality.pending"));
}

export const aiApi = {
  assistantStatus: async (business: Id) => {
    const { data } = await apiClient.get<AIAssistantStatusResponse>("/api/ai/assistant/status/", {
      params: { business },
    });
    return data;
  },
  assistantChat: async ({ business, message, prompt_type }: { business: Id; message: string; prompt_type?: string }) => {
    const key = JSON.stringify([business, message, prompt_type]);
    const existing = pendingChats.get(key);
    if (existing) {
      return waitForChat(await getChatJob(existing, key), key);
    }
    const { data } = await apiClient.post<AIAssistantChatResponse | { job: AIJob }>("/api/ai/assistant/chat/", {
      business,
      message,
      prompt_type,
      idempotency_key: crypto.randomUUID(),
    }, { timeout: 70_000 });
    if ("job" in data) {
      pendingChats.set(key, data.job.id);
      return waitForChat(data.job, key);
    }
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
  suggestTools: async ({ business, conversation, message }: { business: Id; conversation?: Id; message: string }) => {
    const { data } = await apiClient.post<AIToolSuggestResponse>("/api/ai/tools/suggest/", {
      business,
      conversation,
      message,
    });
    return data;
  },
  createToolApproval: async ({ business, toolCallId }: { business: Id; toolCallId: Id }) => {
    const { data } = await apiClient.post<ApprovalRequest>("/api/ai/approval-requests/", {
      business,
      action_type: "ai_pipeline",
      ai_tool_call_log: toolCallId,
      source_object_type: "AIToolCallLog",
      source_object_id: String(toolCallId),
    });
    return data;
  },
  approveToolApproval: async ({ id, reason }: { id: Id; reason?: string }) => {
    const { data } = await apiClient.post<ApprovalRequest>(
      `/api/ai/approval-requests/${id}/approve/`,
      reason ? { reason } : {},
    );
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
