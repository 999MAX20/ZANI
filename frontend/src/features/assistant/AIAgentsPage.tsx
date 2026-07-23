import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  ChevronRight,
  MessageSquareText,
  Plus,
} from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { agentProfilesApi, businessKnowledgeApi } from "../../api/ai";
import { botAiApi, botChannelsApi, botsApi, type BotSuggestedReplyResponse } from "../../api/bots";
import { getApiErrorMessage } from "../../api/client";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import type { AgentProfile, Bot as BotType, BotChannel, BusinessKnowledgeItem } from "../../types";
import {
  AgentActionsSection,
  ChannelManagerSection,
  EmptyAgentsState,
  OnboardingProgress,
  ProfileManagerSection,
  TestAndLaunchSection,
  KnowledgeSection,
} from "./components/AIAgentsSections";
import type { AgentFormState } from "./aiAgentsTypes";
import { canonicalSection, createDefaultProfile, formFromProfile, getOnboardingSteps, jsonFromLines, sections } from "./aiAgentsUtils";
import {
  instagramOAuthCallbackType,
  whatsappEmbeddedSignupCallbackType,
  type InstagramOAuthCallback,
  type WhatsAppEmbeddedSignupCallback,
} from "../integrations/components/setup/metaCallbacks";

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
      <aside className="rounded-card border border-slate-200 bg-white p-4 shadow-card">
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
                  <nav className="ml-4 mt-2 space-y-1 border-l border-slate-200 pl-3">
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
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-zani-muted">
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
