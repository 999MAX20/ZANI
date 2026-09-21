import type { ComponentProps, Dispatch, SetStateAction } from "react";

import type { BotSuggestedReplyResponse } from "../../../api/bots";
import { getApiErrorMessage } from "../../../api/client";
import { CrmWorkspacePage } from "../../../components/crm";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { ErrorState, LoadingState } from "../../../components/ui/StateViews";
import { useI18n } from "../../../lib/i18n";
import type {
  AgentProfile,
  Bot,
  BotChannel,
  BotConversation,
  BotMessage,
  BusinessKnowledgeItem,
  Id,
} from "../../../types";
import type { AgentFormState, AgentSection, BotDraftState } from "../aiAgentsTypes";
import { agentStatusLabel, getOnboardingSteps } from "../aiAgentsUtils";
import { AIAgentEditorShell } from "./AIAgentEditorShell";
import { CreateAgentModal, UnsavedAgentChangesModal } from "./AIAgentModals";
import { AIAgentsListPane } from "./AIAgentsListPane";
import {
  AgentActionsSection,
  ChannelManagerSection,
  EmptyAgentsState,
  KnowledgeSection,
  ProfileManagerSection,
  TestAndLaunchSection,
} from "./AIAgentsSections";

type UpdateBotMutation = ComponentProps<typeof ProfileManagerSection>["updateBot"];
type AddChannelMutation = ComponentProps<typeof ChannelManagerSection>["addChannel"];
type ToggleChannelMutation = ComponentProps<typeof ChannelManagerSection>["toggleChannel"];

export function AIAgentsWorkspace({
  activeSection,
  addChannel,
  botChannels,
  botConversations,
  botDraft,
  botMessages,
  bots,
  businessId,
  canManage,
  canManageChannels,
  canSuggest,
  canViewChannels,
  canViewConversations,
  createAgentPending,
  createError,
  createOpen,
  dirty,
  isSaving,
  knowledgeItems,
  mutationError,
  navigationBlocked,
  newAgentName,
  onCloseCreate,
  onCloseNavigationGuard,
  onCreateAgent,
  onDiscardAndContinue,
  onSaveAndContinue,
  onNavigateSection,
  onSelectAgent,
  onOpenMessages,
  onOpenCreate,
  onReset,
  onRetry,
  onRetrySection,
  onSave,
  onSetNewAgentName,
  onSuggest,
  onToggleStatus,
  pageError,
  profileForm,
  profiles,
  saveState,
  sectionError,
  sectionLoading,
  selectedBot,
  selectedProfile,
  setBotDraft,
  setProfileForm,
  suggestedReply,
  suggestReplyPending,
  toggleChannel,
  updateBot,
}: {
  activeSection: AgentSection;
  addChannel: AddChannelMutation;
  botChannels: BotChannel[];
  botConversations: BotConversation[];
  botDraft: BotDraftState;
  botMessages: BotMessage[];
  bots: Bot[];
  businessId: Id;
  canManage: boolean;
  canManageChannels: boolean;
  canSuggest: boolean;
  canViewChannels: boolean;
  canViewConversations: boolean;
  createAgentPending: boolean;
  createError: unknown;
  createOpen: boolean;
  dirty: boolean;
  isSaving: boolean;
  knowledgeItems: BusinessKnowledgeItem[];
  mutationError: unknown;
  navigationBlocked: boolean;
  newAgentName: string;
  onCloseCreate: () => void;
  onCloseNavigationGuard: () => void;
  onCreateAgent: () => void;
  onDiscardAndContinue: () => void;
  onSaveAndContinue: () => void;
  onNavigateSection: (section: AgentSection) => void;
  onSelectAgent: (id: Id) => void;
  onOpenMessages: () => void;
  onOpenCreate: () => void;
  onReset: () => void;
  onRetry: () => void;
  onRetrySection: () => void;
  onSave: () => void;
  onSetNewAgentName: Dispatch<SetStateAction<string>>;
  onSuggest: (conversationId: number) => void;
  onToggleStatus: (active: boolean) => void;
  pageError: unknown;
  profileForm: AgentFormState;
  profiles: AgentProfile[];
  saveState: ComponentProps<typeof AIAgentEditorShell>["saveState"];
  sectionError: unknown;
  sectionLoading: boolean;
  selectedBot: Bot | null;
  selectedProfile: AgentProfile | null;
  setBotDraft: Dispatch<SetStateAction<BotDraftState>>;
  setProfileForm: Dispatch<SetStateAction<AgentFormState>>;
  suggestedReply: BotSuggestedReplyResponse | null;
  suggestReplyPending: boolean;
  toggleChannel: ToggleChannelMutation;
  updateBot: UpdateBotMutation;
}) {
  const { t } = useI18n();

  if (pageError) {
    return (
      <CrmWorkspacePage maxWidthClassName="max-w-[1520px]">
        <ErrorState
          message={getApiErrorMessage(pageError)}
          action={(
            <Button type="button" variant="secondary" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          )}
        />
      </CrmWorkspacePage>
    );
  }

  const channels = botChannels.filter((channel) => channel.bot === selectedBot?.id);
  const conversations = botConversations.filter((conversation) => conversation.bot === selectedBot?.id);
  const latestConversation = conversations[0];
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  const messages = botMessages.filter((message) => conversationIds.has(message.conversation));
  const latestMessages = latestConversation
    ? messages.filter((message) => message.conversation === latestConversation.id).slice(-6)
    : [];
  const activeChannelsCount = channels.filter((channel) => channel.status === "active").length;
  const activeKnowledgeCount = knowledgeItems.filter((item) => item.is_active).length;
  const launchReady = selectedBot?.readiness?.is_ready
    ?? Boolean(selectedProfile?.is_active && activeChannelsCount > 0 && activeKnowledgeCount > 0);
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
  const channelByName = (name: BotChannel["channel"]) => channels.find((channel) => channel.channel === name);

  return (
    <CrmWorkspacePage
      className="h-auto min-h-0 xl:h-[calc(100dvh-5.5rem)] xl:min-h-[620px]"
      maxWidthClassName="max-w-[1720px]"
      testId="ai-agents-workspace-ready"
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-visible xl:grid-cols-[clamp(260px,18vw,300px)_minmax(0,1fr)] xl:overflow-hidden">
        <AIAgentsListPane
          bots={bots}
          profiles={profiles}
          selectedBotId={selectedBot?.id}
          activeSection={activeSection}
          className="hidden xl:flex"
        />

        {selectedBot ? (
          <div className="xl:hidden">
            <Select
              aria-label={t("aiAgents.agentPickerAria")}
              value={selectedBot.id}
              onChange={(event) => onSelectAgent(Number(event.target.value))}
              options={bots.map((bot) => ({
                value: bot.id,
                label: `${bot.name} · ${agentStatusLabel(bot, t)}`,
              }))}
            />
          </div>
        ) : null}

        {selectedBot ? (
          <AIAgentEditorShell
            bot={selectedBot}
            profile={selectedProfile}
            activeSection={activeSection}
            canManage={canManage}
            activationBlocked={selectedBot.status !== "active" && !launchReady}
            dirty={dirty}
            saveDisabled={!botDraft.name.trim() || !profileForm.name.trim()}
            isSaving={isSaving}
            saveState={saveState}
            onSectionChange={onNavigateSection}
            onToggleStatus={onToggleStatus}
            onOpenMessages={onOpenMessages}
            onReset={onReset}
            onSave={onSave}
            showFooter={activeSection === "profile" || activeSection === "actions"}
          >
            {mutationError ? <ErrorState message={getApiErrorMessage(mutationError)} /> : null}
            {activeSection === "channels" && !canViewChannels ? (
              <ErrorState message={t("aiAgents.channelsPermissionDenied")} />
            ) : activeSection === "test" && !canViewConversations ? (
              <ErrorState message={t("aiAgents.conversationsPermissionDenied")} />
            ) : sectionLoading ? (
              <LoadingState label={t("aiAgents.sectionLoading")} />
            ) : sectionError ? (
              <ErrorState
                message={getApiErrorMessage(sectionError)}
                action={<Button type="button" variant="secondary" onClick={onRetrySection}>{t("common.retry")}</Button>}
              />
            ) : activeSection === "profile" ? (
              <ProfileManagerSection
                bot={selectedBot}
                botDraft={botDraft}
                setBotDraft={setBotDraft}
                form={profileForm}
                setForm={setProfileForm}
                updateBot={updateBot}
                canManage={canManage}
              />
            ) : activeSection === "channels" ? (
              <ChannelManagerSection
                key={selectedBot.id}
                businessId={businessId}
                bot={selectedBot}
                canManage={canManageChannels}
                channelByName={channelByName}
                addChannel={addChannel}
                toggleChannel={toggleChannel}
              />
            ) : activeSection === "knowledge" ? (
              <KnowledgeSection businessId={businessId} items={knowledgeItems} canManage={canManage} />
            ) : activeSection === "actions" ? (
              <AgentActionsSection
                bot={selectedBot}
                form={profileForm}
                setForm={setProfileForm}
                updateBot={updateBot}
                canManage={canManage}
              />
            ) : (
              <TestAndLaunchSection
                bot={selectedBot}
                channelsCount={channels.length}
                activeChannelsCount={activeChannelsCount}
                onboardingSteps={onboardingSteps}
                launchReady={launchReady}
                latestConversation={latestConversation}
                latestMessages={latestMessages}
                suggestedReply={suggestedReply}
                isSuggesting={suggestReplyPending}
                canSuggest={canSuggest}
                onSuggest={() => {
                  if (latestConversation) onSuggest(latestConversation.id);
                }}
              />
            )}
          </AIAgentEditorShell>
        ) : (
          <div className="space-y-3">
            {mutationError ? <ErrorState message={getApiErrorMessage(mutationError)} /> : null}
            <EmptyAgentsState canManage={canManage} onCreate={onOpenCreate} />
          </div>
        )}
      </div>

      <CreateAgentModal
        open={createOpen}
        canManage={canManage}
        error={createError}
        name={newAgentName}
        onNameChange={onSetNewAgentName}
        onClose={onCloseCreate}
        onSubmit={onCreateAgent}
        isCreating={createAgentPending}
      />
      <UnsavedAgentChangesModal
        open={navigationBlocked}
        isSaving={isSaving}
        onClose={onCloseNavigationGuard}
        onDiscard={onDiscardAndContinue}
        onSave={onSaveAndContinue}
      />
    </CrmWorkspacePage>
  );
}
