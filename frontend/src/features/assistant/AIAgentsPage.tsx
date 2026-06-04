import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  FunctionSquare,
  MessageSquareText,
  Plus,
  Radio,
  Save,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { agentProfilesApi } from "../../api/ai";
import { botAiApi, botChannelsApi, botsApi, type BotSuggestedReplyResponse } from "../../api/bots";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Input } from "../../components/ui/Input";
import { MetricCard } from "../../components/ui/MetricCard";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import type { AgentProfile, Bot as BotType, BotChannel, Id } from "../../types";
import { InstagramInlineSetup } from "../integrations/components/setup/InstagramSetup";
import { LogoMark, ToggleSwitch } from "../integrations/components/setup/IntegrationSetupUi";
import { TelegramInlineSetup } from "../integrations/components/setup/TelegramSetup";
import { WhatsAppInlineSetup } from "../integrations/components/setup/WhatsAppSetup";

type AgentSection = "overview" | "settings" | "channels" | "messages" | "prompting" | "control" | "knowledge" | "integrations" | "models" | "functions";
type AgentSectionGroup = "basic" | "behavior" | "data" | "advanced";

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
};

const sections: Array<{ id: AgentSection; labelKey: string; titleKey: string; group: AgentSectionGroup; icon: typeof Settings }> = [
  { id: "overview", labelKey: "aiAgents.section.overview", titleKey: "aiAgents.overviewTitle", group: "basic", icon: Sparkles },
  { id: "settings", labelKey: "aiAgents.section.settings", titleKey: "aiAgents.settingsTitle", group: "basic", icon: Settings },
  { id: "channels", labelKey: "aiAgents.section.channels", titleKey: "aiAgents.channelsTitle", group: "basic", icon: Radio },
  { id: "messages", labelKey: "aiAgents.section.messages", titleKey: "aiAgents.messagesTitle", group: "basic", icon: MessageSquareText },
  { id: "prompting", labelKey: "aiAgents.section.prompting", titleKey: "aiAgents.promptingTitle", group: "behavior", icon: FileText },
  { id: "control", labelKey: "aiAgents.section.control", titleKey: "aiAgents.controlTitle", group: "behavior", icon: Shield },
  { id: "knowledge", labelKey: "aiAgents.section.knowledge", titleKey: "aiAgents.knowledgeTitle", group: "data", icon: BookOpen },
  { id: "integrations", labelKey: "aiAgents.section.integrations", titleKey: "aiAgents.integrationsTitle", group: "data", icon: Zap },
  { id: "models", labelKey: "aiAgents.section.models", titleKey: "aiAgents.modelsTitle", group: "advanced", icon: BrainCircuit },
  { id: "functions", labelKey: "aiAgents.section.functions", titleKey: "aiAgents.functionsTitle", group: "advanced", icon: FunctionSquare },
];

const sectionGroups: AgentSectionGroup[] = ["basic", "behavior", "data", "advanced"];

function jsonFromLines(text: string) {
  return {
    items: text
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function formFromProfile(profile: AgentProfile): AgentFormState {
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
  };
}

function normalizeSection(value?: string): AgentSection {
  return sections.some((item) => item.id === value) ? (value as AgentSection) : "overview";
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
  const activeSection = normalizeSection(params.section);
  const hasInvalidSection = Boolean(requestedSection && requestedSection !== activeSection);
  const { t } = useI18n();
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
  const profiles = useQuery({ queryKey: ["ai-agent-profiles"], queryFn: agentProfilesApi.list });
  const [createOpen, setCreateOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState(() => t("aiAgents.defaultNewAgentName"));
  const [suggestedReply, setSuggestedReply] = useState<BotSuggestedReplyResponse | null>(null);
  const [showAdvancedSections, setShowAdvancedSections] = useState(false);

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
      navigate(`/dashboard/ai-agents/${bot.id}/overview`);
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
        allowed_tools_json: { tools: ["create_lead", "create_task", "handoff_to_manager", "update_deal"] },
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

  if (isBusinessLoading || bots.isLoading || botChannels.isLoading || botConversations.isLoading || botMessages.isLoading || profiles.isLoading) {
    return <LoadingState label={t("aiAgents.loading")} />;
  }

  if (!business) return <ErrorState message={t("aiAgents.noBusiness")} />;

  if (botList.length && selectedBot) {
    const needsCanonicalRoute = !params.id || !matchedBot || !params.section || hasInvalidSection;
    if (needsCanonicalRoute) {
      return <Navigate to={`/dashboard/ai-agents/${selectedBot.id}/${activeSection}`} replace />;
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
  const pageError = bots.error || botChannels.error || botConversations.error || botMessages.error || profiles.error;
  const mutationError = createBot.error || updateBot.error || saveProfile.error || addChannel.error || toggleChannel.error || suggestReply.error;
  const activeSectionMeta = sections.find((section) => section.id === activeSection) || sections[0];
  const groupedSections = sectionGroups
    .map((group) => ({
      key: group,
      sections: sections.filter((section) => section.group === group && (group !== "advanced" || showAdvancedSections || activeSection === section.id)),
    }))
    .filter((group) => group.sections.length);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-midnight md:text-3xl">{t("aiAgents.title")}</h1>
          <p className="mt-1 max-w-2xl text-base leading-6 text-slate-600">{t("aiAgents.description")}</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)} disabled={!canManage}>
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
                  to={`/dashboard/ai-agents/${bot.id}/${activeSection}`}
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
                    {groupedSections.map((group) => (
                      <div key={group.key} className="space-y-1">
                        <p className="px-3 pt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{t(`aiAgents.group.${group.key}`)}</p>
                        {group.sections.map((section) => {
                          const Icon = section.icon;
                          const sectionActive = activeSection === section.id;
                          return (
                            <Link
                              key={section.id}
                              to={`/dashboard/ai-agents/${bot.id}/${section.id}`}
                              className={cn(
                                "flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-bold transition",
                                sectionActive ? "bg-slate-100 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-midnight",
                              )}
                            >
                              <Icon size={16} />
                              <span className="truncate">{t(section.labelKey)}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="mt-2 flex min-h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-midnight"
                      onClick={() => setShowAdvancedSections((value) => !value)}
                    >
                      <SlidersHorizontal size={16} />
                      <span>{showAdvancedSections ? t("aiAgents.hideAdvanced") : t("aiAgents.showAdvanced")}</span>
                    </button>
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
      </aside>

      <main className="min-w-0">
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-midnight md:text-3xl">{t(activeSectionMeta.titleKey)}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
              <Link to="/dashboard/ai-agents" className="hover:text-brand-700">{t("aiAgents.title")}</Link>
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
          <Link to="/dashboard/conversations">
            <Button type="button" variant="secondary">
              <MessageSquareText size={16} /> {t("aiAgents.openMessages")}
            </Button>
          </Link>
        </div>

        {pageError ? <div className="mb-4"><ErrorState message={getApiErrorMessage(pageError)} /></div> : null}
        {mutationError ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutationError)} /></div> : null}

        {!selectedBot ? (
          <EmptyAgentsState onCreate={() => setCreateOpen(true)} />
        ) : activeSection === "overview" ? (
          <OverviewSection bot={selectedBot} channelsCount={channels.length} activeChannelsCount={channels.filter((channel) => channel.status === "active").length} messagesCount={messages.length} latestConversation={latestConversation} />
        ) : activeSection === "settings" ? (
          <SettingsSection bot={selectedBot} channelsCount={channels.length} messagesCount={messages.length} updateBot={updateBot} canManage={canManage} />
        ) : activeSection === "prompting" ? (
          <PromptingSection form={profileForm} setForm={setProfileForm} saveProfile={saveProfile} canManage={canManage} />
        ) : activeSection === "messages" ? (
          <MessagesSection
            latestConversation={latestConversation}
            latestMessages={latestMessages}
            suggestedReply={suggestedReply}
            isSuggesting={suggestReply.isPending}
            onSuggest={() => latestConversation && suggestReply.mutate(latestConversation.id)}
          />
        ) : activeSection === "models" ? (
          <ModelsSection bot={selectedBot} updateBot={updateBot} canManage={canManage} />
        ) : activeSection === "control" ? (
          <ControlSection bot={selectedBot} updateBot={updateBot} canManage={canManage} />
        ) : activeSection === "functions" ? (
          <FunctionsSection />
        ) : activeSection === "knowledge" ? (
          <KnowledgeSection />
        ) : activeSection === "integrations" ? (
          <AgentIntegrationsSection />
        ) : (
          <ChannelsSection
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
              <Link to={`/dashboard/ai-agents/${bot.id}/channels`}>
                <Button type="button" variant="secondary"><Radio size={16} />{t("aiAgents.openChannels")}</Button>
              </Link>
              <Link to={latestConversation ? `/dashboard/ai-agents/${bot.id}/messages` : "/dashboard/conversations"}>
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
            <Input label={t("aiAgents.name")} value={name} onChange={(event) => setName(event.target.value)} />
            <Input label={t("aiAgents.language")} value={language} onChange={(event) => setLanguage(event.target.value)} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MetricCard label={t("aiAgents.statusLabel")} value={bot.status === "active" ? t("aiAgents.status.active") : bot.status === "paused" ? t("aiAgents.status.paused") : t("aiAgents.status.draft")} compact />
            <MetricCard label={t("aiAgents.channelsMetric")} value={String(channelsCount)} compact />
            <MetricCard label={t("aiAgents.messagesMetric")} value={String(messagesCount)} compact />
          </div>

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
          <Input label={t("aiAgents.profileName")} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
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
        </div>

        <div className="mt-4 grid gap-4">
          <Textarea label={t("aiAgents.roleDescription")} value={form.role_description} onChange={(event) => setForm((current) => ({ ...current, role_description: event.target.value }))} />
          <Textarea label={t("aiAgents.systemPrompt")} value={form.system_prompt} onChange={(event) => setForm((current) => ({ ...current, system_prompt: event.target.value }))} />
          <Textarea label={t("aiAgents.rules")} value={form.rules_text} onChange={(event) => setForm((current) => ({ ...current, rules_text: event.target.value }))} />
          <Textarea label={t("aiAgents.escalationRules")} value={form.escalation_text} onChange={(event) => setForm((current) => ({ ...current, escalation_text: event.target.value }))} />
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
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">{t("aiAgents.responseFreedom", { value: temperature.toFixed(1) })}</span>
            <input className="w-full accent-brand-600" type="range" min="0" max="1" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
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
  const settings = bot.settings_json || {};
  const toggles = [
    { key: "auto_handoff", title: t("aiAgents.control.handoffTitle"), text: t("aiAgents.control.handoffText") },
    { key: "require_confirmation", title: t("aiAgents.control.confirmTitle"), text: t("aiAgents.control.confirmText") },
    { key: "hide_internal_data", title: t("aiAgents.control.privacyTitle"), text: t("aiAgents.control.privacyText") },
  ];

  return (
    <div className="space-y-3">
      {toggles.map((item) => {
        const checked = settings[item.key] !== false;
        return (
          <Card key={item.key}>
            <CardBody className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-midnight">{item.title}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{item.text}</p>
              </div>
              <ToggleSwitch
                checked={checked}
                disabled={!canManage}
                isLoading={updateBot.isPending}
                label={item.title}
                onChange={(next) => updateBot.mutate({ settings_json: { ...bot.settings_json, [item.key]: next } })}
              />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function FunctionsSection() {
  const { t } = useI18n();
  const tools = [
    [t("aiAgents.functions.leadTitle"), t("aiAgents.functions.leadText")],
    [t("aiAgents.functions.taskTitle"), t("aiAgents.functions.taskText")],
    [t("aiAgents.functions.dealTitle"), t("aiAgents.functions.dealText")],
    [t("aiAgents.functions.managerTitle"), t("aiAgents.functions.managerText")],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tools.map(([title, text]) => (
        <Card key={title}>
          <CardBody>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <FunctionSquare size={20} />
            </div>
            <h3 className="mt-4 text-lg font-black text-midnight">{title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function KnowledgeSection() {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardBody>
          <BookOpen className="text-brand-600" size={26} />
          <h3 className="mt-4 text-lg font-black text-midnight">{t("aiAgents.knowledgeCompany")}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{t("aiAgents.knowledgeCompanyText")}</p>
          <Link className="mt-4 inline-flex" to="/dashboard/resources">
            <Button type="button" variant="secondary"><ExternalLink size={16} /> {t("aiAgents.openKnowledge")}</Button>
          </Link>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <SlidersHorizontal className="text-brand-600" size={26} />
          <h3 className="mt-4 text-lg font-black text-midnight">{t("aiAgents.knowledgeAccess")}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{t("aiAgents.knowledgeAccessText")}</p>
        </CardBody>
      </Card>
    </div>
  );
}

function AgentIntegrationsSection() {
  const { t } = useI18n();
  const items = [
    [t("aiAgents.integrations.crmTitle"), t("aiAgents.integrations.crmText")],
    [t("aiAgents.integrations.stockTitle"), t("aiAgents.integrations.stockText")],
    [t("aiAgents.integrations.marketplacesTitle"), t("aiAgents.integrations.marketplacesText")],
    [t("aiAgents.integrations.calendarTitle"), t("aiAgents.integrations.calendarText")],
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-black text-midnight">{t("aiAgents.dataSources")}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">{t("aiAgents.dataSourcesText")}</p>
          </div>
          <Link to="/dashboard/integrations">
            <Button type="button" variant="secondary"><ExternalLink size={16} /> {t("aiAgents.openIntegrations")}</Button>
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map(([title, text]) => (
          <Card key={title}>
            <CardBody>
              <h3 className="font-black text-midnight">{title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p>
            </CardBody>
          </Card>
        ))}
      </div>
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
