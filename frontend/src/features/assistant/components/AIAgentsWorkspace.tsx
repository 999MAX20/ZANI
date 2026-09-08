import type { ComponentProps, Dispatch, SetStateAction } from "react";

import type { BotSuggestedReplyResponse } from "../../../api/bots";
import { getApiErrorMessage } from "../../../api/client";
import { CrmWorkspacePage } from "../../../components/crm";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/ui/StateViews";
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
import { getOnboardingSteps } from "../aiAgentsUtils";
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
  createAgentPending,
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
  onNavigateSection,
  onOpenMessages,
  onReset,
  onRetry,
  onSave,
  onSetNewAgentName,
  onSuggest,
  onToggleStatus,
  pageError,
  profileForm,
  profiles,
  saveState,
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
  createAgentPending: boolean;
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
  onNavigateSection: (section: AgentSection) => void;
  onOpenMessages: () => void;
  onReset: () => void;
  onRetry: () => void;
  onSave: () => void;
  onSetNewAgentName: Dispatch<SetStateAction<string>>;
  onSuggest: (conversationId: number) => void;
  onToggleStatus: (active: boolean) => void;
  pageError: unknown;
  profileForm: AgentFormState;
  profiles: AgentProfile[];
  saveState: ComponentProps<typeof AIAgentEditorShell>["saveState"];
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
  const launchReady = Boolean(selectedProfile?.is_active && activeChannelsCount > 0 && activeKnowledgeCount > 0);
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
      className="max-lg:h-[calc(100dvh-7.5rem)]"
      maxWidthClassName="max-w-[1520px]"
      testId="ai-agents-workspace-ready"
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-[300px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
        <AIAgentsListPane
          bots={bots}
          profiles={profiles}
          selectedBotId={selectedBot?.id}
          activeSection={activeSection}
        />

        {selectedBot ? (
          <AIAgentEditorShell
            bot={selectedBot}
            profile={selectedProfile}
            activeSection={activeSection}
            canManage={canManage}
            dirty={dirty}
            saveDisabled={!botDraft.name.trim() || !profileForm.name.trim()}
            isSaving={isSaving}
            saveState={saveState}
            onSectionChange={onNavigateSection}
            onToggleStatus={onToggleStatus}
            onOpenMessages={onOpenMessages}
            onReset={onReset}
            onSave={onSave}
          >
            {mutationError ? <ErrorState message={getApiErrorMessage(mutationError)} /> : null}
            {activeSection === "profile" ? (
              <ProfileManagerSection
                bot={selectedBot}
                channelsCount={channels.length}
                messagesCount={messages.length}
                botDraft={botDraft}
                setBotDraft={setBotDraft}
                form={profileForm}
                setForm={setProfileForm}
                updateBot={updateBot}
                canManage={canManage}
              />
            ) : activeSection === "channels" ? (
              <ChannelManagerSection
                businessId={businessId}
                bot={selectedBot}
                bots={[selectedBot]}
                canManage={canManage}
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
                onSuggest={() => {
                  if (latestConversation) onSuggest(latestConversation.id);
                }}
              />
            )}
          </AIAgentEditorShell>
        ) : (
          <EmptyAgentsState />
        )}
      </div>

      <CreateAgentModal
        open={createOpen}
        canManage={canManage}
        name={newAgentName}
        onNameChange={onSetNewAgentName}
        onClose={onCloseCreate}
        onSubmit={onCreateAgent}
        isCreating={createAgentPending}
      />
      <UnsavedAgentChangesModal
        open={navigationBlocked}
        onClose={onCloseNavigationGuard}
        onDiscard={onDiscardAndContinue}
      />
    </CrmWorkspacePage>
  );
}
