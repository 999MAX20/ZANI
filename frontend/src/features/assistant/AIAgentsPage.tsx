import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileText,
  FunctionSquare,
  MessageSquareText,
  Plus,
  Radio,
  Save,
  Settings,
  Sparkles,
} from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { agentProfilesApi, businessKnowledgeApi } from "../../api/ai";
import { botAiApi, botChannelsApi, botsApi, type BotSuggestedReplyResponse } from "../../api/bots";
import { getApiErrorMessage } from "../../api/client";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Input } from "../../components/ui/Input";
import { MetricCard } from "../../components/ui/MetricCard";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import type { AgentProfile, Bot as BotType, BotChannel, BusinessKnowledgeItem, Id } from "../../types";
import { InstagramInlineSetup } from "../integrations/components/setup/InstagramSetup";
import { LogoMark, ToggleSwitch } from "../integrations/components/setup/IntegrationSetupUi";
import { TelegramInlineSetup } from "../integrations/components/setup/TelegramSetup";
import { WhatsAppInlineSetup } from "../integrations/components/setup/WhatsAppSetup";
import {
  instagramOAuthCallbackType,
  whatsappEmbeddedSignupCallbackType,
  type InstagramOAuthCallback,
  type WhatsAppEmbeddedSignupCallback,
} from "../integrations/components/setup/metaCallbacks";

type AgentSection = "profile" | "channels" | "knowledge" | "actions" | "test";

type AgentFormState = {
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

type AutoPipelineMode = "off" | "triage" | "lead_task" | "draft_deal";

const defaultAllowedTools = ["create_lead", "create_task", "create_deal", "handoff_to_manager"];

const sections: Array<{ id: AgentSection; labelKey: string; titleKey: string; icon: typeof Settings }> = [
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

function jsonFromLines(text: string) {
  return {
    items: text
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function formFromProfile(profile: AgentProfile): AgentFormState {
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

function createDefaultProfile(bot: BotType | null | undefined, t: (key: string) => string): AgentFormState {
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

function autoPipelineFromSettings(settings: Record<string, unknown>) {
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

function canonicalSection(value?: string): AgentSection {
  if (!value) return "profile";
  if (sections.some((item) => item.id === value)) return value as AgentSection;
  return legacySectionMap[value] || "profile";
}

function channelStatus(channel: BotChannel | undefined, t: (key: string) => string) {
  if (!channel) return t("aiAgents.status.notConnected");
  if (channel.status === "active") return t("aiAgents.status.connected");
  if (channel.status === "error") return t("aiAgents.status.error");
  return t("aiAgents.status.setup");
}

function channelStatusClass(channel?: BotChannel) {
  if (!channel) return "bg-slate-100 text-slate-700 ring-slate-200";
  if (channel.status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (channel.status === "error") return "bg-red-50 text-red-700 ring-red-100";
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

export function AIAgentsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const selectedBotId = params.id ? Number(params.id) : null;
  const requestedSection = params.section;
  const activeSection = canonicalSection(params.section);
  const hasInvalidSection = Boolean(requestedSection && requestedSection !== activeSection);
  const { t } = useI18n();
  const { setPageHeader } = usePageHeader();
  const { user } = useAuth();
  const { business, isLoading: isBusinessLoading } = useActiveBusiness();
  const canManage = hasPermission(user, business?.id, "ai_automation", "manage");
  const queryClient = useQueryClient();
  const { bots, botChannels, botConversations, botMessages } = useEntityData({
    bots: true,
    botChannels: true,
    botConversations: true,
    botMessages: true,
  });
  const profiles = useQuery<AgentProfile[]>({ queryKey: ["ai-agent-profiles"], queryFn: () => agentProfilesApi.list() });
  const knowledge = useQuery<BusinessKnowledgeItem[]>({
    queryKey: ["ai-knowledge-items", business?.id],
    queryFn: () => businessKnowledgeApi.list(),
    enabled: Boolean(business),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState(() => t("aiAgents.defaultNewAgentName"));
  const [suggestedReply, setSuggestedReply] = useState<BotSuggestedReplyResponse | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return;
    const provider = url.searchParams.get("zani_provider");

    const payload = provider === "instagram"
      ? {
          type: instagramOAuthCallbackType,
          code,
          state,
        } satisfies InstagramOAuthCallback
      : {
          type: whatsappEmbeddedSignupCallbackType,
          code,
          state,
          phone_number_id: url.searchParams.get("phone_number_id") || undefined,
          waba_id: url.searchParams.get("waba_id") || undefined,
          display_phone_number: url.searchParams.get("display_phone_number") || undefined,
        } satisfies WhatsAppEmbeddedSignupCallback;

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return;
    }

    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("zani_provider");
    url.searchParams.delete("phone_number_id");
    url.searchParams.delete("waba_id");
    url.searchParams.delete("display_phone_number");
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const botList = bots.data || [];
  const matchedBot = selectedBotId ? botList.find((bot) => bot.id === selectedBotId) || null : null;
  const selectedBot = matchedBot || botList[0] || null;
  const selectedProfile = useMemo(
    () => (profiles.data || []).find((profile) => profile.bot === selectedBot?.id) || (profiles.data || [])[0] || null,
    [profiles.data, selectedBot?.id],
  );
  const [profileForm, setProfileForm] = useState<AgentFormState>(() => createDefaultProfile(selectedBot, t));

  useEffect(() => {
    if (selectedProfile) {
      setProfileForm(formFromProfile(selectedProfile));
    } else {
      setProfileForm(createDefaultProfile(selectedBot, t));
    }
  }, [selectedProfile, selectedBot?.id]);

  const createBot = useMutation({
    mutationFn: () =>
      botsApi.create({
        business: Number(business?.id),
        name: newAgentName.trim() || t("aiAgents.defaultNewAgentName"),
        status: "draft",
        default_language: "ru",
        settings_json: {},
      }),
    onSuccess: async (bot) => {
      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      setCreateOpen(false);
      setNewAgentName(t("aiAgents.defaultNewAgentName"));
      navigate(`/app/ai-agents/${bot.id}/profile`);
    },
  });

  const updateBot = useMutation({
    mutationFn: (payload: Partial<BotType>) => {
      if (!selectedBot) throw new Error("Agent is not selected.");
      return botsApi.update({ id: selectedBot.id, payload });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bots"] }),
  });

  const saveProfile = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is not selected.");
      const payload = {
        business: business.id,
        bot: selectedBot?.id || (profileForm.bot ? Number(profileForm.bot) : null),
        name: profileForm.name,
        role_description: profileForm.role_description,
        tone: profileForm.tone,
        language: profileForm.language,
        is_active: profileForm.is_active,
        system_prompt: profileForm.system_prompt,
        rules_json: jsonFromLines(profileForm.rules_text),
        allowed_tools_json: { tools: profileForm.allowed_tools },
        escalation_rules_json: jsonFromLines(profileForm.escalation_text),
      };
      return profileForm.id ? agentProfilesApi.update({ id: profileForm.id, payload }) : agentProfilesApi.create(payload);
    },
    onSuccess: async (profile) => {
      await queryClient.invalidateQueries({ queryKey: ["ai-agent-profiles"] });
      setProfileForm(formFromProfile(profile));
    },
  });

  const addChannel = useMutation({
    mutationFn: (channel: BotChannel["channel"]) => {
      if (!selectedBot) throw new Error("Agent is not selected.");
      return botChannelsApi.create({
        bot: selectedBot.id,
        channel,
        status: "draft",
        external_id: "",
        config_json: channel === "whatsapp" ? { provider_mode: "meta_cloud" } : channel === "instagram" ? { provider_mode: "meta_graph" } : {},
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-channels"] }),
  });

  const toggleChannel = useMutation({
    mutationFn: ({ channel, status }: { channel: BotChannel; status: BotChannel["status"] }) =>
      botChannelsApi.update({ id: channel.id, payload: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-channels"] }),
  });

  const suggestReply = useMutation({
    mutationFn: (conversationId: number) => botAiApi.suggestReply(conversationId),
    onSuccess: (data) => setSuggestedReply(data),
  });

  useEffect(() => {
    setPageHeader({
      title: t("nav.aiAgents"),
      primaryAction: canManage
        ? {
            label: t("aiAgents.createAgent"),
            icon: Plus,
            onClick: () => setCreateOpen(true),
          }
        : undefined,
    });
    return () => setPageHeader(null);
  }, [canManage, setPageHeader, t]);

  if (isBusinessLoading || bots.isLoading || botChannels.isLoading || botConversations.isLoading || botMessages.isLoading || profiles.isLoading || knowledge.isLoading) {
    return <LoadingState label={t("aiAgents.loading")} />;
  }

  if (!business) return <ErrorState message={t("aiAgents.noBusiness")} />;

  if (botList.length && selectedBot) {
    const needsCanonicalRoute = !params.id || !matchedBot || !params.section || hasInvalidSection;
    if (needsCanonicalRoute) {
      return <Navigate to={`/app/ai-agents/${selectedBot.id}/${activeSection}`} replace />;
    }
  }

  const channels = (botChannels.data || []).filter((channel) => channel.bot === selectedBot?.id);
  const channelByName = (name: BotChannel["channel"]) => channels.find((channel) => channel.channel === name);
  const conversations = (botConversations.data || []).filter((conversation) => conversation.bot === selectedBot?.id);
  const latestConversation = conversations[0];
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  const messages = (botMessages.data || []).filter((message) => conversationIds.has(message.conversation));
  const latestMessages = latestConversation ? messages.filter((message) => message.conversation === latestConversation.id).slice(-6) : [];
  const selectedBotsOnly = selectedBot ? [selectedBot] : [];
  const activeChannelsCount = channels.filter((channel) => channel.status === "active").length;
  const activeKnowledgeCount = (knowledge.data || []).filter((item) => item.is_active).length;
  const pageError = bots.error || botChannels.error || botConversations.error || botMessages.error || profiles.error || knowledge.error;
  const mutationError = createBot.error || updateBot.error || saveProfile.error || addChannel.error || toggleChannel.error || suggestReply.error;
  const activeSectionMeta = sections.find((section) => section.id === activeSection) || sections[0];
  const onboardingSteps = selectedBot
    ? getOnboardingSteps({
        botId: selectedBot.id,
        profileReady: Boolean(selectedProfile?.is_active),
        hasActiveChannel: activeChannelsCount > 0,
        hasKnowledge: activeKnowledgeCount > 0,
        hasTestDialog: Boolean(latestConversation),
        t,
      })
    : [];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-midnight md:text-3xl">{t("aiAgents.title")}</h1>
          <p className="mt-1 max-w-2xl text-base leading-6 text-slate-600">{t("aiAgents.description")}</p>
        </div>
        <Button type="button" className="lg:hidden" onClick={() => setCreateOpen(true)} disabled={!canManage}>
          <Plus size={16} /> {t("aiAgents.createAgent")}
        </Button>
      </section>

    <div className="mx-auto grid w-full max-w-[1320px] gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-slate-200 bg-white/92 p-4 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">{t("aiAgents.eyebrow")}</p>
            <h2 className="mt-1 text-2xl font-black text-midnight">{t("aiAgents.title")}</h2>
          </div>
          <Button type="button" className="h-9 w-9 rounded-xl px-0" variant="secondary" onClick={() => setCreateOpen(true)} aria-label={t("aiAgents.createAgent")}>
            <Plus size={16} />
          </Button>
        </div>

        <div className="space-y-2">
          {botList.map((bot) => {
            const active = bot.id === selectedBot?.id;
            return (
              <div key={bot.id} className="rounded-2xl">
                <Link
                  to={`/app/ai-agents/${bot.id}/${activeSection}`}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-black transition",
                    active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50 hover:text-midnight",
                  )}
                >
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500")}>
                    <Bot size={17} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{bot.name}</span>
                  <ChevronRight size={15} className={cn("shrink-0", active && "rotate-90")} />
                </Link>

                {active ? (
                  <nav className="ml-4 mt-2 space-y-1 border-l border-slate-100 pl-3">
                    {sections.map((section) => {
                      const Icon = section.icon;
                      const sectionActive = activeSection === section.id;
                      return (
                        <Link
                          key={section.id}
                          to={`/app/ai-agents/${bot.id}/${section.id}`}
                          className={cn(
                            "flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold transition",
                            sectionActive ? "bg-slate-100 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-midnight",
                          )}
                        >
                          <Icon size={16} />
                          <span className="truncate">{t(section.labelKey)}</span>
                        </Link>
                      );
                    })}
                  </nav>
                ) : null}
              </div>
            );
          })}
        </div>

        {!botList.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            {t("aiAgents.sidebarEmpty")}
          </div>
        ) : null}

        {selectedBot ? <OnboardingProgress steps={onboardingSteps} compact /> : null}
      </aside>

      <main className="min-w-0">
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-midnight md:text-3xl">{t(activeSectionMeta.titleKey)}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
              <Link to="/app/ai-agents" className="hover:text-brand-700">{t("aiAgents.title")}</Link>
              {selectedBot ? (
                <>
                  <ChevronRight size={15} />
                  <span className="text-slate-700">{selectedBot.name}</span>
                  <ChevronRight size={15} />
                  <span className="text-midnight">{t(activeSectionMeta.titleKey)}</span>
                </>
              ) : null}
            </div>
          </div>
          <Link to="/app/conversations">
            <Button type="button" variant="secondary">
              <MessageSquareText size={16} /> {t("aiAgents.openMessages")}
            </Button>
          </Link>
        </div>

        {pageError ? <div className="mb-4"><ErrorState message={getApiErrorMessage(pageError)} /></div> : null}
        {mutationError ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutationError)} /></div> : null}

        {!selectedBot ? (
          <EmptyAgentsState onCreate={() => setCreateOpen(true)} />
        ) : activeSection === "profile" ? (
          <ProfileManagerSection
            bot={selectedBot}
            channelsCount={channels.length}
            messagesCount={messages.length}
            form={profileForm}
            setForm={setProfileForm}
            updateBot={updateBot}
            saveProfile={saveProfile}
            canManage={canManage}
          />
        ) : activeSection === "test" ? (
          <TestAndLaunchSection
            bot={selectedBot}
            channelsCount={channels.length}
            activeChannelsCount={activeChannelsCount}
            knowledgeCount={activeKnowledgeCount}
            onboardingSteps={onboardingSteps}
            latestConversation={latestConversation}
            latestMessages={latestMessages}
            suggestedReply={suggestedReply}
            isSuggesting={suggestReply.isPending}
            onSuggest={() => latestConversation && suggestReply.mutate(latestConversation.id)}
            updateBot={updateBot}
            canManage={canManage}
          />
        ) : activeSection === "actions" ? (
          <AgentActionsSection
            bot={selectedBot}
            form={profileForm}
            setForm={setProfileForm}
            updateBot={updateBot}
            saveProfile={saveProfile}
            canManage={canManage}
          />
        ) : activeSection === "knowledge" ? (
          <KnowledgeSection businessId={business.id} items={knowledge.data || []} canManage={canManage} />
        ) : (
          <ChannelManagerSection
            businessId={business.id}
            bot={selectedBot}
            bots={selectedBotsOnly}
            canManage={canManage}
            channelByName={channelByName}
            addChannel={addChannel}
            toggleChannel={toggleChannel}
          />
        )}
      </main>

      <Modal title={t("aiAgents.newAgentTitle")} open={createOpen} onClose={() => setCreateOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createBot.mutate();
          }}
        >
          <Input label={t("aiAgents.agentName")} value={newAgentName} onChange={(event) => setNewAgentName(event.target.value)} placeholder={t("aiAgents.agentNamePlaceholder")} />
          <Button type="submit" disabled={!canManage || !newAgentName.trim()} isLoading={createBot.isPending}>
            <Plus size={16} /> {t("aiAgents.createAgent")}
          </Button>
        </form>
      </Modal>
    </div>
    </div>
  );
}

function EmptyAgentsState({ onCreate }: { onCreate: () => void }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardBody className="flex flex-col items-center justify-center py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white">
          <Bot size={24} />
        </div>
        <h3 className="mt-4 text-2xl font-black text-midnight">{t("aiAgents.emptyAgentsTitle")}</h3>
        <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
          {t("aiAgents.emptyAgentsText")}
        </p>
        <Button className="mt-5" type="button" onClick={onCreate}>
          <Plus size={16} /> {t("aiAgents.createAgent")}
        </Button>
      </CardBody>
    </Card>
  );
}

function HelpCard({ title, text, recommendation }: { title: string; text: string; recommendation: string }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-700">
          <Sparkles size={18} />
        </div>
        <div>
          <h3 className="font-black text-midnight">{title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{text}</p>
          <p className="mt-2 text-sm font-black leading-6 text-brand-800">{recommendation}</p>
        </div>
      </div>
    </div>
  );
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{children}</p>;
}

function getOnboardingSteps({
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
}) {
  return [
    { done: profileReady, title: t("aiAgents.checklist.profile"), text: t("aiAgents.checklist.profileText"), href: `/app/ai-agents/${botId}/profile` },
    { done: hasKnowledge, title: t("aiAgents.checklist.knowledge"), text: t("aiAgents.checklist.knowledgeText"), href: `/app/ai-agents/${botId}/knowledge` },
    { done: hasActiveChannel, title: t("aiAgents.checklist.channel"), text: t("aiAgents.checklist.channelText"), href: `/app/ai-agents/${botId}/channels` },
    { done: hasTestDialog, title: t("aiAgents.checklist.test"), text: t("aiAgents.checklist.testText"), href: `/app/ai-agents/${botId}/test` },
  ];
}

function OnboardingProgress({
  steps,
  compact = false,
}: {
  steps: Array<{ done: boolean; title: string; text: string; href: string }>;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const doneCount = steps.filter((step) => step.done).length;
  const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4", compact ? "mt-5" : "shadow-sm")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t("aiAgents.firstLaunch")}</p>
          <h3 className="mt-1 font-black text-midnight">{t("aiAgents.firstLaunchTitle")}</h3>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-black text-brand-700">{doneCount}/{steps.length}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 space-y-2">
        {steps.map((step) => (
          <Link
            key={step.title}
            to={step.href}
            className="flex gap-3 rounded-xl p-2 transition hover:bg-slate-50"
          >
            <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white", step.done ? "bg-emerald-500" : "bg-slate-300")}>
              <CheckCircle2 size={14} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-midnight">{step.title}</span>
              {!compact ? <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{step.text}</span> : null}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ProfileManagerSection({
  bot,
  channelsCount,
  messagesCount,
  form,
  setForm,
  updateBot,
  saveProfile,
  canManage,
}: {
  bot: BotType;
  channelsCount: number;
  messagesCount: number;
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  updateBot: ReturnType<typeof useMutation<BotType, Error, Partial<BotType>>>;
  saveProfile: ReturnType<typeof useMutation<AgentProfile, Error, void>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [showQuality, setShowQuality] = useState(false);

  return (
    <div className="space-y-5">
      <HelpCard
        title={t("aiAgents.onboarding.profile.helpTitle")}
        text={t("aiAgents.onboarding.profile.helpText")}
        recommendation={t("aiAgents.onboarding.profile.recommendation")}
      />
      <SettingsSection bot={bot} channelsCount={channelsCount} messagesCount={messagesCount} updateBot={updateBot} canManage={canManage} />
      <PromptingSection form={form} setForm={setForm} saveProfile={saveProfile} canManage={canManage} />
      <Card>
        <CardBody>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowQuality((value) => !value)}
          >
            <div>
              <h3 className="text-lg font-black text-midnight">{t("aiAgents.qualityAdvanced")}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">{t("aiAgents.qualityAdvancedText")}</p>
            </div>
            <ChevronRight size={18} className={cn("shrink-0 text-slate-400 transition", showQuality && "rotate-90 text-brand-700")} />
          </button>
        </CardBody>
      </Card>
      {showQuality ? <ModelsSection bot={bot} updateBot={updateBot} canManage={canManage} /> : null}
    </div>
  );
}

function AgentActionsSection({
  bot,
  form,
  setForm,
  updateBot,
  saveProfile,
  canManage,
}: {
  bot: BotType;
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  updateBot: ReturnType<typeof useMutation<BotType, Error, Partial<BotType>>>;
  saveProfile: ReturnType<typeof useMutation<AgentProfile, Error, void>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <HelpCard
        title={t("aiAgents.onboarding.actions.helpTitle")}
        text={t("aiAgents.onboarding.actions.helpText")}
        recommendation={t("aiAgents.onboarding.actions.recommendation")}
      />
      <ControlSection bot={bot} updateBot={updateBot} canManage={canManage} />
      <FunctionsSection form={form} setForm={setForm} saveProfile={saveProfile} canManage={canManage} />
    </div>
  );
}

function TestAndLaunchSection({
  bot,
  channelsCount,
  activeChannelsCount,
  knowledgeCount,
  onboardingSteps,
  latestConversation,
  latestMessages,
  suggestedReply,
  isSuggesting,
  onSuggest,
  updateBot,
  canManage,
}: {
  bot: BotType;
  channelsCount: number;
  activeChannelsCount: number;
  knowledgeCount: number;
  onboardingSteps: Array<{ done: boolean; title: string; text: string; href: string }>;
  latestConversation?: { id: Id } | null;
  latestMessages: Array<{ id: Id; direction: string; text: string }>;
  suggestedReply: BotSuggestedReplyResponse | null;
  isSuggesting: boolean;
  onSuggest: () => void;
  updateBot: ReturnType<typeof useMutation<BotType, Error, Partial<BotType>>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <HelpCard
        title={t("aiAgents.onboarding.test.helpTitle")}
        text={t("aiAgents.onboarding.test.helpText")}
        recommendation={t("aiAgents.onboarding.test.recommendation")}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <OnboardingProgress steps={onboardingSteps} />
        <Card>
          <CardBody className="flex h-full flex-col justify-between gap-5">
            <div>
              <h3 className="text-xl font-black text-midnight">{t("aiAgents.launchControlTitle")}</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{t("aiAgents.launchControlText")}</p>
              <FieldHint>{knowledgeCount > 0 && activeChannelsCount > 0 ? t("aiAgents.hint.launchReady") : t("aiAgents.hint.launchNotReady")}</FieldHint>
            </div>
            <Button
              type="button"
              variant={bot.status === "active" ? "secondary" : "ai"}
              disabled={!canManage}
              isLoading={updateBot.isPending}
              onClick={() => updateBot.mutate({ status: bot.status === "active" ? "paused" : "active" })}
            >
              <CheckCircle2 size={16} /> {bot.status === "active" ? t("aiAgents.pauseAgent") : t("aiAgents.activateAgent")}
            </Button>
          </CardBody>
        </Card>
      </div>

      <OverviewSection bot={bot} channelsCount={channelsCount} activeChannelsCount={activeChannelsCount} messagesCount={latestMessages.length} latestConversation={latestConversation} />
      <MessagesSection latestConversation={latestConversation} latestMessages={latestMessages} suggestedReply={suggestedReply} isSuggesting={isSuggesting} onSuggest={onSuggest} />
    </div>
  );
}

function OverviewSection({
  bot,
  channelsCount,
  activeChannelsCount,
  messagesCount,
  latestConversation,
}: {
  bot: BotType;
  channelsCount: number;
  activeChannelsCount: number;
  messagesCount: number;
  latestConversation?: { id: Id } | null;
}) {
  const { t } = useI18n();
  const statusLabel = bot.status === "active" ? t("aiAgents.status.active") : bot.status === "paused" ? t("aiAgents.status.paused") : t("aiAgents.status.draft");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label={t("aiAgents.statusLabel")} value={statusLabel} icon={Bot} tone={bot.status === "active" ? "emerald" : "slate"} compact />
        <MetricCard label={t("aiAgents.connectedChannels")} value={`${activeChannelsCount}/${channelsCount}`} icon={Radio} tone="brand" compact />
        <MetricCard label={t("aiAgents.messagesMetric")} value={messagesCount} icon={MessageSquareText} tone="slate" compact />
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t("aiAgents.nextSetup")}</p>
              <h3 className="mt-2 text-2xl font-black text-midnight">{bot.name}</h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">{t("aiAgents.overviewText")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/app/ai-agents/${bot.id}/channels`}>
                <Button type="button" variant="secondary"><Radio size={16} />{t("aiAgents.openChannels")}</Button>
              </Link>
              <Link to={latestConversation ? `/app/ai-agents/${bot.id}/test` : "/app/conversations"}>
                <Button type="button"><MessageSquareText size={16} />{t("aiAgents.testMessages")}</Button>
              </Link>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function SettingsSection({
  bot,
  channelsCount,
  messagesCount,
  updateBot,
  canManage,
}: {
  bot: BotType;
  channelsCount: number;
  messagesCount: number;
  updateBot: ReturnType<typeof useMutation<BotType, Error, Partial<BotType>>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(bot.name);
  const [language, setLanguage] = useState(bot.default_language);

  useEffect(() => {
    setName(bot.name);
    setLanguage(bot.default_language);
  }, [bot.id, bot.name, bot.default_language]);

  return (
    <div className="space-y-5">
      <Card>
        <CardBody>
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-midnight">{t("aiAgents.generalSettings")}</h3>
              <p className="text-sm font-semibold text-slate-500">{t("aiAgents.generalSettingsText")}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Input label={t("aiAgents.name")} value={name} onChange={(event) => setName(event.target.value)} />
              <FieldHint>{t("aiAgents.hint.agentName")}</FieldHint>
            </div>
            <div>
              <Input label={t("aiAgents.language")} value={language} onChange={(event) => setLanguage(event.target.value)} />
              <FieldHint>{t("aiAgents.hint.agentLanguage")}</FieldHint>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MetricCard label={t("aiAgents.statusLabel")} value={bot.status === "active" ? t("aiAgents.status.active") : bot.status === "paused" ? t("aiAgents.status.paused") : t("aiAgents.status.draft")} compact />
            <MetricCard label={t("aiAgents.channelsMetric")} value={String(channelsCount)} compact />
            <MetricCard label={t("aiAgents.messagesMetric")} value={String(messagesCount)} compact />
          </div>
          <FieldHint>{t("aiAgents.hint.agentStatus")}</FieldHint>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!canManage || !name.trim()}
              isLoading={updateBot.isPending}
              onClick={() => updateBot.mutate({ name, default_language: language })}
            >
              <Save size={16} /> {t("common.save")}
            </Button>
            <Button
              type="button"
              variant={bot.status === "active" ? "secondary" : "ai"}
              disabled={!canManage}
              isLoading={updateBot.isPending}
              onClick={() => updateBot.mutate({ status: bot.status === "active" ? "paused" : "active" })}
            >
              <CheckCircle2 size={16} /> {bot.status === "active" ? t("aiAgents.pauseAgent") : t("aiAgents.activateAgent")}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function PromptingSection({
  form,
  setForm,
  saveProfile,
  canManage,
}: {
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  saveProfile: ReturnType<typeof useMutation<AgentProfile, Error, void>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <CardBody>
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700">
            <FileText size={22} />
          </div>
          <div>
            <h3 className="text-xl font-black text-midnight">{t("aiAgents.instructionTitle")}</h3>
            <p className="text-sm font-semibold text-slate-500">{t("aiAgents.instructionText")}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Input label={t("aiAgents.profileName")} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.profileName")}</FieldHint>
          </div>
          <div>
            <Select
              label={t("aiAgents.tone")}
              value={form.tone}
              onChange={(event) => setForm((current) => ({ ...current, tone: event.target.value as AgentProfile["tone"] }))}
              options={[
                { value: "friendly", label: t("aiAgents.tone.friendly") },
                { value: "expert", label: t("aiAgents.tone.expert") },
                { value: "formal", label: t("aiAgents.tone.formal") },
                { value: "sales", label: t("aiAgents.tone.sales") },
                { value: "support", label: t("aiAgents.tone.support") },
              ]}
            />
            <FieldHint>{t("aiAgents.hint.tone")}</FieldHint>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <div>
            <Textarea label={t("aiAgents.roleDescription")} value={form.role_description} onChange={(event) => setForm((current) => ({ ...current, role_description: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.role")}</FieldHint>
          </div>
          <div>
            <Textarea label={t("aiAgents.systemPrompt")} value={form.system_prompt} onChange={(event) => setForm((current) => ({ ...current, system_prompt: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.systemPrompt")}</FieldHint>
          </div>
          <div>
            <Textarea label={t("aiAgents.rules")} value={form.rules_text} onChange={(event) => setForm((current) => ({ ...current, rules_text: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.rules")}</FieldHint>
          </div>
          <div>
            <Textarea label={t("aiAgents.escalationRules")} value={form.escalation_text} onChange={(event) => setForm((current) => ({ ...current, escalation_text: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.escalation")}</FieldHint>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" disabled={!canManage} isLoading={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
            <Save size={16} /> {t("aiAgents.saveBehavior")}
          </Button>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-600">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            {t("aiAgents.profileActive")}
          </label>
        </div>
      </CardBody>
    </Card>
  );
}

function MessagesSection({
  latestConversation,
  latestMessages,
  suggestedReply,
  isSuggesting,
  onSuggest,
}: {
  latestConversation?: { id: Id } | null;
  latestMessages: Array<{ id: Id; direction: string; text: string }>;
  suggestedReply: BotSuggestedReplyResponse | null;
  isSuggesting: boolean;
  onSuggest: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardBody>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-midnight">{t("aiAgents.latestDialog")}</h3>
              <p className="text-sm font-semibold text-slate-500">{t("aiAgents.latestDialogText")}</p>
            </div>
            <Button type="button" variant="secondary" disabled={!latestConversation} isLoading={isSuggesting} onClick={onSuggest}>
              <Sparkles size={16} /> {t("aiAgents.prepareReply")}
            </Button>
          </div>
          <div className="space-y-3">
            {latestMessages.length ? latestMessages.map((message) => (
              <div key={message.id} className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{message.direction === "inbound" ? t("aiAgents.client") : t("aiAgents.reply")}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{message.text || t("aiAgents.emptyMessage")}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                {t("aiAgents.noDialogs")}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-xl font-black text-midnight">{t("aiAgents.draftReply")}</h3>
          <div className="mt-4 min-h-40 rounded-3xl bg-ai-50 p-4 text-sm font-semibold leading-7 text-ai-900">
            {suggestedReply?.suggested_reply || t("aiAgents.draftReplyEmpty")}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function ModelsSection({ bot, updateBot, canManage }: { bot: BotType; updateBot: ReturnType<typeof useMutation<BotType, Error, Partial<BotType>>>; canManage: boolean }) {
  const { t } = useI18n();
  const settings = bot.settings_json || {};
  const [model, setModel] = useState(String(settings.model || "gpt-4.1"));
  const [temperature, setTemperature] = useState(Number(settings.temperature ?? 0.4));

  useEffect(() => {
    setModel(String(bot.settings_json?.model || "gpt-4.1"));
    setTemperature(Number(bot.settings_json?.temperature ?? 0.4));
  }, [bot.id, bot.settings_json]);

  return (
    <Card>
      <CardBody>
        <h3 className="text-xl font-black text-midnight">{t("aiAgents.modelsTitle")}</h3>
        <div className="mt-4 grid gap-4">
          <Select
            label={t("aiAgents.responseMode")}
            value={model}
            onChange={(event) => setModel(event.target.value)}
            options={[
              { value: "gpt-4.1", label: t("aiAgents.responseMode.quality") },
              { value: "gpt-4.1-mini", label: t("aiAgents.responseMode.fast") },
              { value: "gpt-4o-mini", label: t("aiAgents.responseMode.economy") },
            ]}
          />
          <FieldHint>{t("aiAgents.hint.responseMode")}</FieldHint>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">{t("aiAgents.responseFreedom", { value: temperature.toFixed(1) })}</span>
            <input className="w-full accent-brand-600" type="range" min="0" max="1" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
            <FieldHint>{t("aiAgents.hint.temperature")}</FieldHint>
          </label>
          <Button
            type="button"
            disabled={!canManage}
            isLoading={updateBot.isPending}
            onClick={() => updateBot.mutate({ settings_json: { ...bot.settings_json, model, temperature } })}
          >
            <Save size={16} /> {t("common.save")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ControlSection({ bot, updateBot, canManage }: { bot: BotType; updateBot: ReturnType<typeof useMutation<BotType, Error, Partial<BotType>>>; canManage: boolean }) {
  const { t } = useI18n();
  const [config, setConfig] = useState(() => autoPipelineFromSettings(bot.settings_json || {}));
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setConfig(autoPipelineFromSettings(bot.settings_json || {}));
  }, [bot.id, bot.settings_json]);

  const saveConfig = () => {
    const nextConfig = {
      ...config,
      enabled: config.mode !== "off" && config.enabled,
      min_lead_confidence: Math.max(0.1, Math.min(config.min_lead_confidence, 1)),
      min_deal_confidence: Math.max(0.1, Math.min(config.min_deal_confidence, 1)),
      max_auto_reply_chars: Math.max(120, Math.min(config.max_auto_reply_chars, 2000)),
    };
    updateBot.mutate({
      settings_json: {
        ...bot.settings_json,
        auto_crm_pipeline: nextConfig,
      },
    });
  };

  return (
    <Card>
      <CardBody>
        <div className="mb-5">
          <h3 className="text-xl font-black text-midnight">{t("aiAgents.control.pipelineTitle")}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{t("aiAgents.control.pipelineText")}</p>
        </div>

        <Select
          label={t("aiAgents.control.mode")}
          value={config.mode}
          onChange={(event) => {
            const mode = event.target.value as AutoPipelineMode;
            setConfig((current) => ({ ...current, mode, enabled: mode !== "off" }));
          }}
          options={[
            { value: "off", label: t("aiAgents.control.mode.off") },
            { value: "triage", label: t("aiAgents.control.mode.triage") },
            { value: "lead_task", label: t("aiAgents.control.mode.leadTask") },
            { value: "draft_deal", label: t("aiAgents.control.mode.draftDeal") },
          ]}
        />
        <FieldHint>{t("aiAgents.hint.pipelineMode")}</FieldHint>

        <div className="mt-5 grid gap-3">
          {[
            ["require_review_on_fallback", t("aiAgents.control.reviewFallbackTitle"), t("aiAgents.control.reviewFallbackText")],
            ["create_appointment", t("aiAgents.control.appointmentTitle"), t("aiAgents.control.appointmentText")],
            ["auto_send_reply", t("aiAgents.control.autoReplyTitle"), t("aiAgents.control.autoReplyText")],
          ].map(([key, title, text]) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div>
                <h4 className="font-black text-midnight">{title}</h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">{text}</p>
              </div>
              <ToggleSwitch
                checked={Boolean(config[key as keyof typeof config])}
                disabled={!canManage || config.mode === "off"}
                label={title}
                onChange={(next) => setConfig((current) => ({ ...current, [key]: next }))}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            <div>
              <h4 className="font-black text-midnight">{t("aiAgents.control.advancedTitle")}</h4>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{t("aiAgents.control.advancedText")}</p>
            </div>
            <ChevronRight size={18} className={cn("shrink-0 text-slate-400 transition", showAdvanced && "rotate-90 text-brand-700")} />
          </button>

          {showAdvanced ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Input
                  label={t("aiAgents.control.maxReplyChars")}
                  type="number"
                  min={120}
                  max={2000}
                  value={config.max_auto_reply_chars}
                  onChange={(event) => setConfig((current) => ({ ...current, max_auto_reply_chars: Number(event.target.value) }))}
                />
                <FieldHint>{t("aiAgents.hint.maxReplyChars")}</FieldHint>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">{t("aiAgents.control.leadConfidence", { value: config.min_lead_confidence.toFixed(1) })}</span>
                <input className="w-full accent-brand-600" type="range" min="0.1" max="1" step="0.1" value={config.min_lead_confidence} onChange={(event) => setConfig((current) => ({ ...current, min_lead_confidence: Number(event.target.value) }))} />
                <FieldHint>{t("aiAgents.hint.leadConfidence")}</FieldHint>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-700">{t("aiAgents.control.dealConfidence", { value: config.min_deal_confidence.toFixed(1) })}</span>
                <input className="w-full accent-brand-600" type="range" min="0.1" max="1" step="0.1" value={config.min_deal_confidence} onChange={(event) => setConfig((current) => ({ ...current, min_deal_confidence: Number(event.target.value) }))} />
                <FieldHint>{t("aiAgents.hint.dealConfidence")}</FieldHint>
              </label>
            </div>
          ) : null}
        </div>

        <Button className="mt-5" type="button" disabled={!canManage} isLoading={updateBot.isPending} onClick={saveConfig}>
          <Save size={16} /> {t("common.save")}
        </Button>
      </CardBody>
    </Card>
  );
}

function FunctionsSection({
  form,
  setForm,
  saveProfile,
  canManage,
}: {
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  saveProfile: ReturnType<typeof useMutation<AgentProfile, Error, void>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const tools = [
    ["create_lead", t("aiAgents.functions.leadTitle"), t("aiAgents.functions.leadText")],
    ["create_task", t("aiAgents.functions.taskTitle"), t("aiAgents.functions.taskText")],
    ["create_deal", t("aiAgents.functions.dealTitle"), t("aiAgents.functions.dealText")],
    ["handoff_to_manager", t("aiAgents.functions.managerTitle"), t("aiAgents.functions.managerText")],
  ];
  const toggleTool = (tool: string, enabled: boolean) => {
    setForm((current) => ({
      ...current,
      allowed_tools: enabled
        ? Array.from(new Set([...current.allowed_tools, tool]))
        : current.allowed_tools.filter((item) => item !== tool),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {tools.map(([key, title, text]) => {
          const enabled = form.allowed_tools.includes(key);
          return (
        <Card key={key}>
          <CardBody className="flex min-h-[170px] flex-col">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <FunctionSquare size={20} />
            </div>
            <h3 className="mt-4 text-lg font-black text-midnight">{title}</h3>
            <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-500">{text}</p>
            <FieldHint>{t(`aiAgents.hint.tool.${key}`)}</FieldHint>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm font-black text-slate-600">{enabled ? t("aiAgents.functions.enabled") : t("aiAgents.functions.disabled")}</span>
              <ToggleSwitch checked={enabled} disabled={!canManage} label={title} onChange={(next) => toggleTool(key, next)} />
            </div>
          </CardBody>
        </Card>
          );
        })}
      </div>
      <Button type="button" disabled={!canManage} isLoading={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
        <Save size={16} /> {t("aiAgents.functions.save")}
      </Button>
    </div>
  );
}

function KnowledgeSection({ businessId, items, canManage }: { businessId: Id; items: BusinessKnowledgeItem[]; canManage: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessKnowledgeItem | null>(null);
  const [draft, setDraft] = useState({ title: "", category: "business", content: "", is_active: true });
  const saveKnowledge = useMutation({
    mutationFn: () => {
      const payload = { ...draft, business: businessId };
      return editing ? businessKnowledgeApi.update({ id: editing.id, payload }) : businessKnowledgeApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-items"] });
      setOpen(false);
      setEditing(null);
      setDraft({ title: "", category: "business", content: "", is_active: true });
    },
  });

  const openEditor = (item?: BusinessKnowledgeItem) => {
    if (item) {
      setEditing(item);
      setDraft({ title: item.title, category: item.category || "business", content: item.content, is_active: item.is_active });
    } else {
      setEditing(null);
      setDraft({ title: "", category: "business", content: "", is_active: true });
    }
    setOpen(true);
  };

  const knowledgeTemplates = [
    { title: t("aiAgents.knowledge.template.prices"), category: "sales", content: t("aiAgents.knowledge.template.pricesContent") },
    { title: t("aiAgents.knowledge.template.schedule"), category: "business", content: t("aiAgents.knowledge.template.scheduleContent") },
    { title: t("aiAgents.knowledge.template.booking"), category: "policy", content: t("aiAgents.knowledge.template.bookingContent") },
    { title: t("aiAgents.knowledge.template.faq"), category: "faq", content: t("aiAgents.knowledge.template.faqContent") },
  ];

  const openTemplate = (template: { title: string; category: string; content: string }) => {
    setEditing(null);
    setDraft({ ...template, is_active: true });
    setOpen(true);
  };

  return (
    <>
      <div className="space-y-4">
        <HelpCard
          title={t("aiAgents.onboarding.knowledge.helpTitle")}
          text={t("aiAgents.onboarding.knowledge.helpText")}
          recommendation={t("aiAgents.onboarding.knowledge.recommendation")}
        />
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-black text-midnight">{t("aiAgents.knowledgeCompany")}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">{t("aiAgents.knowledgeCompanyText")}</p>
            </div>
            <Button type="button" disabled={!canManage} onClick={() => openEditor()}>
              <Plus size={16} /> {t("aiAgents.knowledge.add")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {items.length ? items.map((item) => (
            <Card key={item.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{item.category || t("aiAgents.knowledge.category")}</p>
                    <h3 className="mt-2 text-lg font-black text-midnight">{item.title}</h3>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-black", item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                    {item.is_active ? t("aiAgents.knowledge.active") : t("aiAgents.knowledge.off")}
                  </span>
                </div>
                <p className="mt-3 line-clamp-4 text-sm font-semibold leading-6 text-slate-500">{item.content}</p>
                <Button className="mt-4" type="button" variant="secondary" disabled={!canManage} onClick={() => openEditor(item)}>
                  <Settings size={16} /> {t("aiAgents.configure")}
                </Button>
              </CardBody>
            </Card>
          )) : (
            <Card className="md:col-span-2">
              <CardBody>
                <BookOpen className="text-brand-600" size={26} />
                <h3 className="mt-4 text-lg font-black text-midnight">{t("aiAgents.knowledge.emptyTitle")}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{t("aiAgents.knowledge.emptyText")}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {knowledgeTemplates.map((template) => (
                    <button
                      key={template.title}
                      type="button"
                      disabled={!canManage}
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-200 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => openTemplate(template)}
                    >
                      <span className="text-sm font-black text-midnight">{template.title}</span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{template.category}</span>
                    </button>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal title={editing ? t("aiAgents.knowledge.editTitle") : t("aiAgents.knowledge.newTitle")} open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveKnowledge.mutate();
          }}
        >
          <Input label={t("aiAgents.knowledge.title")} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          <FieldHint>{t("aiAgents.hint.knowledgeTitle")}</FieldHint>
          <Input label={t("aiAgents.knowledge.category")} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
          <FieldHint>{t("aiAgents.hint.knowledgeCategory")}</FieldHint>
          <Textarea label={t("aiAgents.knowledge.content")} value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} />
          <FieldHint>{t("aiAgents.hint.knowledgeContent")}</FieldHint>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-600">
            <input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.checked }))} />
            {t("aiAgents.knowledge.useInContext")}
          </label>
          <FieldHint>{t("aiAgents.hint.knowledgeActive")}</FieldHint>
          <Button type="submit" disabled={!canManage || !draft.title.trim() || !draft.content.trim()} isLoading={saveKnowledge.isPending}>
            <Save size={16} /> {t("common.save")}
          </Button>
        </form>
      </Modal>
    </>
  );
}

function ChannelManagerSection(props: {
  businessId: Id;
  bot: BotType;
  bots: BotType[];
  canManage: boolean;
  channelByName: (name: BotChannel["channel"]) => BotChannel | undefined;
  addChannel: ReturnType<typeof useMutation<BotChannel, Error, BotChannel["channel"]>>;
  toggleChannel: ReturnType<typeof useMutation<BotChannel, Error, { channel: BotChannel; status: BotChannel["status"] }>>;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <HelpCard
        title={t("aiAgents.onboarding.channels.helpTitle")}
        text={t("aiAgents.onboarding.channels.helpText")}
        recommendation={t("aiAgents.onboarding.channels.recommendation")}
      />
      <ChannelsSection {...props} />
    </div>
  );
}

function ChannelsSection({
  businessId,
  bot,
  bots,
  canManage,
  channelByName,
  addChannel,
  toggleChannel,
}: {
  businessId: Id;
  bot: BotType;
  bots: BotType[];
  canManage: boolean;
  channelByName: (name: BotChannel["channel"]) => BotChannel | undefined;
  addChannel: ReturnType<typeof useMutation<BotChannel, Error, BotChannel["channel"]>>;
  toggleChannel: ReturnType<typeof useMutation<BotChannel, Error, { channel: BotChannel; status: BotChannel["status"] }>>;
}) {
  const { t } = useI18n();
  const [setupChannel, setSetupChannel] = useState<BotChannel["channel"] | null>(null);
  const channelCards: Array<{ key: BotChannel["channel"]; title: string; description: string; logo?: string }> = [
    { key: "website", title: t("aiAgents.channel.website"), description: t("aiAgents.channel.websiteText") },
    { key: "telegram", title: "Telegram", description: t("aiAgents.channel.telegramText"), logo: "/integrations_logos/telegram.png" },
    { key: "whatsapp", title: "WhatsApp", description: t("aiAgents.channel.whatsappText"), logo: "/integrations_logos/whatsapp.png" },
    { key: "instagram", title: "Instagram", description: t("aiAgents.channel.instagramText"), logo: "/integrations_logos/instagram.png" },
  ];
  const activeChannel = setupChannel ? channelByName(setupChannel) : undefined;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {channelCards.map((item) => {
          const channel = channelByName(item.key);
          const connected = channel?.status === "active";
          return (
            <article key={item.key} className="min-h-[142px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <LogoMark logo={item.logo} label={item.title} />
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    className="h-9 min-w-[118px] rounded-xl px-4 text-sm"
                    disabled={!canManage || addChannel.isPending}
                    isLoading={addChannel.isPending && !channel}
                    onClick={() => {
                      if (!channel && item.key === "website") {
                        addChannel.mutate("website");
                        return;
                      }
                      setSetupChannel(item.key);
                    }}
                  >
                    {channel ? t("aiAgents.configure") : t("aiAgents.connect")}
                  </Button>
                  {channel ? (
                    <ToggleSwitch
                      checked={connected}
                      disabled={!canManage}
                      isLoading={toggleChannel.isPending}
                      label={`${item.title}: ${connected ? t("aiAgents.disable") : t("aiAgents.enable")}`}
                      onChange={(checked) => toggleChannel.mutate({ channel, status: checked ? "active" : "paused" })}
                    />
                  ) : null}
                </div>
              </div>
              <div className="mt-4 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-midnight">{item.title}</h3>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1", channelStatusClass(channel))}>
                    {channelStatus(channel, t)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-500">{item.description}</p>
                <FieldHint>{t(`aiAgents.hint.channel.${item.key}`)}</FieldHint>
              </div>
            </article>
          );
        })}
      </div>

      <Modal title={setupChannel ? t("aiAgents.connectionTitle", { title: channelCards.find((item) => item.key === setupChannel)?.title || "" }) : t("aiAgents.connection")} open={Boolean(setupChannel)} onClose={() => setSetupChannel(null)}>
        {setupChannel === "telegram" ? (
          <TelegramInlineSetup businessId={businessId} bots={bots} canManage={canManage} channel={activeChannel} />
        ) : setupChannel === "whatsapp" ? (
          <WhatsAppInlineSetup businessId={businessId} bots={bots} canManage={canManage} channel={activeChannel} />
        ) : setupChannel === "instagram" ? (
          <InstagramInlineSetup businessId={businessId} bots={bots} canManage={canManage} channel={activeChannel} />
        ) : setupChannel === "website" ? (
          <WebsiteSetup bot={bot} channel={activeChannel} />
        ) : null}
      </Modal>
    </>
  );
}

function WebsiteSetup({ bot, channel }: { bot: BotType; channel?: BotChannel }) {
  const { t } = useI18n();
  const widgetApiBase = import.meta.env.VITE_API_URL || window.location.origin;
  const snippet = channel ? `<script src=\"/widget/zani-widget.js\" data-zani-token=\"${channel.public_token}\" data-zani-api=\"${widgetApiBase}\"></script>` : "";
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-100 bg-white p-4">
        <h3 className="text-lg font-black text-midnight">{t("aiAgents.websiteSetupTitle")}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
          {t("aiAgents.websiteSetupText", { name: bot.name })}
        </p>
      </div>
      {channel ? (
        <pre className="max-h-56 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs font-semibold leading-6 text-white">{snippet}</pre>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
          {t("aiAgents.websiteSetupEmpty")}
        </div>
      )}
    </div>
  );
}
