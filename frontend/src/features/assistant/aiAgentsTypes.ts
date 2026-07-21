import type { AgentProfile, Id } from "../../types";

export type AgentSection = "profile" | "channels" | "knowledge" | "actions" | "test";

export type AgentFormState = {
  id: Id | null;
  name: string;
  bot: string;
  role_description: string;
  tone: AgentProfile["tone"];
  language: string;
  is_active: boolean;
  system_prompt: string;
  rules_text: string;
  escalation_text: string;
  allowed_tools: string[];
};

export type AutoPipelineMode = "off" | "triage" | "lead_task" | "draft_deal";

export type OnboardingStep = {
  done: boolean;
  title: string;
  text: string;
  href: string;
};
