import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router";

import { agentProfilesApi, businessKnowledgeApi } from "../../api/ai";
import { botAiApi, botChannelsApi, botsApi, type BotSuggestedReplyResponse } from "../../api/bots";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useAuth } from "../auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import type { AgentProfile, Bot as BotType, BotChannel, BusinessKnowledgeItem } from "../../types";
import { AIAgentsWorkspace } from "./components/AIAgentsWorkspace";
import { jsonFromLines } from "./aiAgentsUtils";
import { useAIAgentEditorDrafts } from "./useAIAgentEditorDrafts";
import { useCanonicalAIAgentRoute } from "./useCanonicalAIAgentRoute";
import { useMetaOAuthCallbackBridge } from "./useMetaOAuthCallbackBridge";

export function AIAgentsPage() {
  const navigate = useNavigate();
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
  useMetaOAuthCallbackBridge();

  const botList = bots.data || [];
  const isPageLoading = isBusinessLoading
    || bots.isLoading
    || botChannels.isLoading
    || botConversations.isLoading
    || botMessages.isLoading
    || profiles.isLoading
    || knowledge.isLoading;
  const { activeSection, canonicalRoute, selectedBot } = useCanonicalAIAgentRoute({
    bots: botList,
    hasBusiness: Boolean(business),
    isPageLoading,
  });

  const selectedProfile = useMemo(
    () => (profiles.data || []).find((profile) => profile.bot === selectedBot?.id) || null,
    [profiles.data, selectedBot?.id],
  );
  const [isSavingEditor, setIsSavingEditor] = useState(false);
  const {
    botDraft,
    editorDirty,
    markBotSaved,
    markProfileSaved,
    navigationBlocker,
    profileForm,
    resetEditorDrafts,
    saveState,
    setBotDraft,
    setProfileForm,
    setSaveState,
  } = useAIAgentEditorDrafts({ selectedBot, selectedProfile, t });

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
    onSuccess: (updatedBot, payload) => {
      if ("name" in payload || "default_language" in payload) {
        markBotSaved(updatedBot);
      }
      return queryClient.invalidateQueries({ queryKey: ["bots"] });
    },
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
      markProfileSaved(profile);
      await queryClient.invalidateQueries({ queryKey: ["ai-agent-profiles"] });
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

  const saveEditorDrafts = useCallback(async () => {
    if (!selectedBot || !canManage || !botDraft.name.trim() || !profileForm.name.trim()) return;
    setIsSavingEditor(true);
    try {
      const [updatedBot, updatedProfile] = await Promise.all([
        updateBot.mutateAsync({
          name: botDraft.name.trim(),
          default_language: botDraft.default_language.trim() || "ru",
        }),
        saveProfile.mutateAsync(),
      ]);
      markBotSaved(updatedBot);
      markProfileSaved(updatedProfile);
      setSaveState("saved");
    } finally {
      setIsSavingEditor(false);
    }
  }, [botDraft, canManage, markBotSaved, markProfileSaved, profileForm.name, saveProfile, selectedBot, setSaveState, updateBot]);

  useEffect(() => {
    setPageHeader({
      title: t("nav.aiAgents"),
      primaryAction: canManage
        ? {
            label: t("aiAgents.createAgent"),
            icon: Plus,
            variant: "primary",
            disabled: editorDirty,
            title: editorDirty ? t("aiAgents.unsavedIndicator") : undefined,
            onClick: () => setCreateOpen(true),
          }
        : undefined,
    });
    return () => setPageHeader(null);
  }, [canManage, editorDirty, setPageHeader, t]);

  if (isPageLoading) {
    return <LoadingState label={t("aiAgents.loading")} />;
  }

  if (!business) return <ErrorState message={t("aiAgents.noBusiness")} />;

  if (canonicalRoute) {
    return <LoadingState label={t("aiAgents.loading")} />;
  }

  const pageError = bots.error || botChannels.error || botConversations.error || botMessages.error || profiles.error || knowledge.error;
  const mutationError = createBot.error || updateBot.error || saveProfile.error || addChannel.error || toggleChannel.error || suggestReply.error;

  const closeNavigationGuard = () => {
    if (navigationBlocker.state === "blocked") navigationBlocker.reset();
  };

  const discardAndContinue = () => {
    if (navigationBlocker.state !== "blocked") return;
    resetEditorDrafts();
    navigationBlocker.proceed();
  };

  return (
    <AIAgentsWorkspace
      activeSection={activeSection}
      addChannel={addChannel}
      botChannels={botChannels.data || []}
      botConversations={botConversations.data || []}
      botDraft={botDraft}
      botMessages={botMessages.data || []}
      bots={botList}
      businessId={business.id}
      canManage={canManage}
      createAgentPending={createBot.isPending}
      createOpen={createOpen}
      dirty={editorDirty}
      isSaving={isSavingEditor || updateBot.isPending}
      knowledgeItems={knowledge.data || []}
      mutationError={mutationError}
      navigationBlocked={navigationBlocker.state === "blocked"}
      newAgentName={newAgentName}
      onCloseCreate={() => setCreateOpen(false)}
      onCloseNavigationGuard={closeNavigationGuard}
      onCreateAgent={() => createBot.mutate()}
      onDiscardAndContinue={discardAndContinue}
      onNavigateSection={(section) => navigate(`/app/ai-agents/${selectedBot?.id}/${section}`)}
      onOpenMessages={() => navigate("/app/conversations")}
      onReset={resetEditorDrafts}
      onRetry={() => void Promise.all([
        bots.refetch(),
        botChannels.refetch(),
        botConversations.refetch(),
        botMessages.refetch(),
        profiles.refetch(),
        knowledge.refetch(),
      ])}
      onSave={() => void saveEditorDrafts()}
      onSetNewAgentName={setNewAgentName}
      onSuggest={(conversationId) => suggestReply.mutate(conversationId)}
      onToggleStatus={(active) => updateBot.mutate({ status: active ? "active" : "paused" })}
      pageError={pageError}
      profileForm={profileForm}
      profiles={profiles.data || []}
      saveState={saveState}
      selectedBot={selectedBot}
      selectedProfile={selectedProfile}
      setBotDraft={setBotDraft}
      setProfileForm={setProfileForm}
      suggestedReply={suggestedReply}
      suggestReplyPending={suggestReply.isPending}
      toggleChannel={toggleChannel}
      updateBot={updateBot}
    />
  );
}
