import { BookOpen, Bot, FunctionSquare, MessageSquareText, Radio, Settings } from "lucide-react";

import type { AgentProfile, Bot as BotType, BotChannel, Id } from "../../types";
import type { AgentFormState, AgentSection, AutoPipelineMode, OnboardingStep } from "./aiAgentsTypes";

export const defaultAllowedTools = ["create_lead", "create_task", "create_deal", "handoff_to_manager"];

export const sections: Array<{ id: AgentSection; labelKey: string; titleKey: string; icon: typeof Settings }> = [
  { id: "profile", labelKey: "aiAgents.section.profile", titleKey: "aiAgents.profileTitle", icon: Bot },
  { id: "channels", labelKey: "aiAgents.section.channels", titleKey: "aiAgents.channelsTitle", icon: Radio },
  { id: "knowledge", labelKey: "aiAgents.section.knowledgeSimple", titleKey: "aiAgents.knowledgeTitle", icon: BookOpen },
  { id: "actions", labelKey: "aiAgents.section.actions", titleKey: "aiAgents.actionsTitle", icon: FunctionSquare },
  { id: "test", labelKey: "aiAgents.section.test", titleKey: "aiAgents.testTitle", icon: MessageSquareText },
];

const legacySectionMap: Record<string, AgentSection> = {
  overview: "test",
  settings: "profile",
  prompting: "profile",
  models: "profile",
  integrations: "knowledge",
  control: "actions",
  functions: "actions",
  messages: "test",
};

export function jsonFromLines(text: string) {
  return {
    items: text
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export function formFromProfile(profile: AgentProfile): AgentFormState {
  const tools = Array.isArray(profile.allowed_tools_json?.tools)
    ? (profile.allowed_tools_json.tools as unknown[]).map(String)
    : defaultAllowedTools;
  return {
    id: profile.id,
    name: profile.name,
    bot: profile.bot ? String(profile.bot) : "",
    role_description: profile.role_description,
    tone: profile.tone,
    language: profile.language,
    is_active: profile.is_active,
    system_prompt: profile.system_prompt,
    rules_text: Array.isArray(profile.rules_json?.items) ? (profile.rules_json.items as string[]).join("\n") : "",
    escalation_text: Array.isArray(profile.escalation_rules_json?.items) ? (profile.escalation_rules_json.items as string[]).join("\n") : "",
    allowed_tools: tools,
  };
}

export function createDefaultProfile(bot: BotType | null | undefined, t: (key: string) => string): AgentFormState {
  return {
    id: null,
    name: bot ? `${bot.name} ${t("aiAgents.profileSuffix")}` : t("aiAgents.defaultName"),
    bot: bot ? String(bot.id) : "",
    role_description: t("aiAgents.defaultRoleDescription"),
    tone: "friendly",
    language: bot?.default_language || "ru",
    is_active: true,
    system_prompt: t("aiAgents.defaultSystemPrompt"),
    rules_text: t("aiAgents.defaultRules"),
    escalation_text: t("aiAgents.defaultEscalation"),
    allowed_tools: defaultAllowedTools,
  };
}

export function autoPipelineFromSettings(settings: Record<string, unknown>) {
  const raw = settings.auto_crm_pipeline && typeof settings.auto_crm_pipeline === "object"
    ? settings.auto_crm_pipeline as Record<string, unknown>
    : {};
  const mode = typeof raw.mode === "string" && ["off", "triage", "lead_task", "draft_deal"].includes(raw.mode)
    ? raw.mode as AutoPipelineMode
    : "off";
  return {
    enabled: Boolean(raw.enabled ?? mode !== "off"),
    mode,
    min_lead_confidence: Number(raw.min_lead_confidence ?? 0.7),
    min_deal_confidence: Number(raw.min_deal_confidence ?? 0.8),
    require_review_on_fallback: raw.require_review_on_fallback !== false,
    create_appointment: Boolean(raw.create_appointment),
    auto_send_reply: Boolean(raw.auto_send_reply),
    max_auto_reply_chars: Number(raw.max_auto_reply_chars ?? 900),
  };
}

export function canonicalSection(value?: string): AgentSection {
  if (!value) return "profile";
  if (sections.some((item) => item.id === value)) return value as AgentSection;
  return legacySectionMap[value] || "profile";
}

export function channelStatus(channel: BotChannel | undefined, t: (key: string) => string) {
  if (!channel) return t("aiAgents.status.notConnected");
  if (channel.status === "active") return t("aiAgents.status.connected");
  if (channel.status === "error") return t("aiAgents.status.error");
  return t("aiAgents.status.setup");
}

export function channelStatusClass(channel?: BotChannel) {
  if (!channel) return "bg-slate-100 text-slate-700 ring-slate-200";
  if (channel.status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (channel.status === "error") return "bg-red-50 text-red-700 ring-red-100";
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

export function getOnboardingSteps({
  botId,
  profileReady,
  hasActiveChannel,
  hasKnowledge,
  hasTestDialog,
  t,
}: {
  botId: Id;
  profileReady: boolean;
  hasActiveChannel: boolean;
  hasKnowledge: boolean;
  hasTestDialog: boolean;
  t: (key: string) => string;
}): OnboardingStep[] {
  return [
    { done: profileReady, title: t("aiAgents.checklist.profile"), text: t("aiAgents.checklist.profileText"), href: `/app/ai-agents/${botId}/profile` },
    { done: hasKnowledge, title: t("aiAgents.checklist.knowledge"), text: t("aiAgents.checklist.knowledgeText"), href: `/app/ai-agents/${botId}/knowledge` },
    { done: hasActiveChannel, title: t("aiAgents.checklist.channel"), text: t("aiAgents.checklist.channelText"), href: `/app/ai-agents/${botId}/channels` },
    { done: hasTestDialog, title: t("aiAgents.checklist.test"), text: t("aiAgents.checklist.testText"), href: `/app/ai-agents/${botId}/test` },
  ];
}
