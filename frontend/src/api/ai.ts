import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { AgentProfile, Id } from "../types";

export type AIAssistantChatResponse = {
  answer: string;
  is_mock: boolean;
  model: string;
  tokens_used: number;
  log_id: Id;
  context: {
    clients_count: number;
    new_leads_count: number;
    open_appointments_count: number;
  };
};

export const aiApi = {
  assistantChat: async ({ business, message, prompt_type }: { business: Id; message: string; prompt_type?: string }) => {
    const { data } = await apiClient.post<AIAssistantChatResponse>("/api/ai/assistant/chat/", {
      business,
      message,
      prompt_type,
    });
    return data;
  },
};

export type AgentProfilePayload = Omit<Partial<AgentProfile>, "rules_json" | "allowed_tools_json" | "escalation_rules_json"> & {
  rules_json?: Record<string, unknown>;
  allowed_tools_json?: Record<string, unknown>;
  escalation_rules_json?: Record<string, unknown>;
};

export const agentProfilesApi = createCrudApi<AgentProfile, AgentProfilePayload, AgentProfilePayload>("/api/ai/agent-profiles/");
