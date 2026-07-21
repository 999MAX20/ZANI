import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bot, CheckCircle2, MessageSquareText, Radio, Sparkles } from "lucide-react";

import type { BotSuggestedReplyResponse } from "../../../api/bots";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { MetricCard } from "../../../components/ui/MetricCard";
import { useI18n } from "../../../lib/i18n";
import type { Bot as BotType, Id } from "../../../types";
import type { OnboardingStep } from "../aiAgentsTypes";
import { HelpCard, FieldHint, OnboardingProgress } from "./AIAgentsShared";
export function TestAndLaunchSection({
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
          <div className="mt-4 min-h-40 rounded-card bg-ai-50 p-4 text-sm font-semibold leading-7 text-ai-900">
            {suggestedReply?.suggested_reply || t("aiAgents.draftReplyEmpty")}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
