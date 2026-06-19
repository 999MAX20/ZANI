import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot as BotIcon, Copy, ExternalLink, MessageSquareText, Plus, Radio, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { botAiApi, botChannelsApi, botsApi, websiteChatApi, type BotSuggestedReplyResponse } from "../../api/bots";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { BotChannel } from "../../types";

export function BotDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const botId = Number(params.id);
  const queryClient = useQueryClient();
  const { botChannels, botConversations, botMessages } = useEntityData({ botChannels: true, botConversations: true, botMessages: true });
  const [preview, setPreview] = useState({
    full_name: t("botDetail.previewNameDefault"),
    phone: "+77010000000",
    email: "",
    message: t("botDetail.previewMessageDefault"),
  });
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewConversationId, setPreviewConversationId] = useState<string | null>(null);
  const [followUpMessage, setFollowUpMessage] = useState(t("botDetail.followUpDefault"));
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [suggestedReply, setSuggestedReply] = useState<BotSuggestedReplyResponse | null>(null);
  const bot = useQuery({
    queryKey: ["bots", botId],
    queryFn: () => botsApi.get(botId),
    enabled: Number.isFinite(botId),
  });

  const addWebsiteChannel = useMutation({
    mutationFn: () => botChannelsApi.create({ bot: botId, channel: "website", status: "draft", external_id: "", config_json: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-channels"] }),
  });
  const addWhatsAppChannel = useMutation({
    mutationFn: () => botChannelsApi.create({ bot: botId, channel: "whatsapp", status: "draft", external_id: "", config_json: { provider_mode: "mock" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-channels"] }),
  });
  const previewMutation = useMutation({
    mutationFn: (publicToken: string) => websiteChatApi.createConversation({ publicToken, payload: preview }),
    onSuccess: (data) => {
      setPreviewConversationId(data.conversation_id);
      setPreviewResult(t("botDetail.previewCreated", { conversation: data.conversation_id, lead: data.lead_id || t("botDetail.leadNotCreated") }));
      queryClient.invalidateQueries({ queryKey: ["bot-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["bot-messages"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
  const followUpMutation = useMutation({
    mutationFn: ({ publicToken, conversationId }: { publicToken: string; conversationId: string }) =>
      websiteChatApi.sendMessage({ publicToken, conversationId, message: followUpMessage }),
    onSuccess: (data) => {
      setPreviewResult(t("botDetail.followUpCreated", { conversation: data.conversation_id }));
      queryClient.invalidateQueries({ queryKey: ["bot-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["bot-messages"] });
    },
  });

  const suggestReplyMutation = useMutation({
    mutationFn: (conversationId: number) => botAiApi.suggestReply(conversationId),
    onSuccess: (data) => setSuggestedReply(data),
  });

  if (bot.isLoading || botChannels.isLoading || botConversations.isLoading || botMessages.isLoading) return <LoadingState />;
  if (bot.error) return <ErrorState message={getApiErrorMessage(bot.error)} />;
  if (!bot.data) return <ErrorState message={t("botDetail.notFound")} />;

  const channels = (botChannels.data || []).filter((channel) => channel.bot === bot.data.id);
  const websiteChannel = channels.find((channel) => channel.channel === "website");
  const whatsappChannel = channels.find((channel) => channel.channel === "whatsapp");
  const conversations = (botConversations.data || []).filter((conversation) => conversation.bot === bot.data.id);
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  const messages = (botMessages.data || []).filter((message) => conversationIds.has(message.conversation));
  const latestConversation = conversations[0];
  const latestConversationMessages = latestConversation
    ? messages.filter((message) => message.conversation === latestConversation.id).slice(-6)
    : [];
  const widgetApiBase = import.meta.env.VITE_API_URL || window.location.origin;
  const widgetSnippet = websiteChannel
    ? `<script src="/widget/zani-widget.js" data-zani-token="${websiteChannel.public_token}" data-zani-api="${widgetApiBase}"></script>`
    : "";

  return (
    <>
      <PageHeader
        title={bot.data.name}
        description={t("botDetail.description")}
        actions={
          <>
            <Link to="/app/bots"><Button variant="secondary"><ArrowLeft size={16} />{t("common.back")}</Button></Link>
            <Button
              variant="ai"
              onClick={() => addWebsiteChannel.mutate()}
              isLoading={addWebsiteChannel.isPending}
              disabled={Boolean(websiteChannel)}
            >
              <Plus size={16} />{t("botDetail.addWebsiteChannel")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => addWhatsAppChannel.mutate()}
              isLoading={addWhatsAppChannel.isPending}
              disabled={Boolean(whatsappChannel)}
            >
              <Plus size={16} />{t("botDetail.addWhatsAppChannel")}
            </Button>
          </>
        }
      />
      {addWebsiteChannel.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(addWebsiteChannel.error)} /></div> : null}
      {addWhatsAppChannel.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(addWhatsAppChannel.error)} /></div> : null}
      {previewMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(previewMutation.error)} /></div> : null}
      {followUpMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(followUpMutation.error)} /></div> : null}
      {suggestReplyMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(suggestReplyMutation.error)} /></div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                <BotIcon size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-midnight">{t("botDetail.profileTitle")}</h2>
                <p className="text-sm text-slate-500">{t("botDetail.language", { language: bot.data.default_language.toUpperCase() })}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <span className="text-sm font-semibold text-slate-600">{t("botDetail.status")}</span>
                <StatusBadge status={bot.data.status} />
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <span className="text-sm font-semibold text-slate-600">{t("botDetail.channels")}</span>
                <span className="font-bold text-midnight">{channels.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <span className="text-sm font-semibold text-slate-600">{t("botDetail.messages")}</span>
                <span className="font-bold text-midnight">{messages.length}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-midnight">{t("botDetail.channels")}</h2>
                <p className="text-sm text-slate-500">{t("botDetail.secretsSafe")}</p>
              </div>
            </div>
            <div className="grid gap-3">
              {channels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                      <Radio size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-midnight">{t(`botDetail.channel.${channel.channel}`)}</p>
                      <p className="text-sm text-slate-500">{channel.external_id || t("botDetail.externalIdMissing")}</p>
                      {channel.channel === "website" ? (
                        <p className="mt-1 text-xs font-semibold text-brand-700">{t("botDetail.widgetCodeConfigured")}</p>
                      ) : null}
                    </div>
                  </div>
                  <StatusBadge status={channel.status} />
                </div>
              ))}
              {!channels.length ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
                  {t("botDetail.noChannels")}
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Radio size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-midnight">{t("aiAgents.channelsTitle")}</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{t("aiAgents.onboarding.channels.helpText")}</p>
              </div>
            </div>
            <Link to={`/app/ai-agents/${bot.data.id}/channels`}>
              <Button type="button">
                <ExternalLink size={16} /> {t("aiAgents.openChannels")}
              </Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <MessageSquareText size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-midnight">{t("botDetail.websitePreviewTitle")}</h2>
                <p className="text-sm text-slate-500">{t("botDetail.websitePreviewDescription")}</p>
              </div>
            </div>
            {websiteChannel ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{t("botDetail.widgetInstallCode")}</p>
                    <StatusBadge status={websiteChannel.status} />
                  </div>
	                  <pre className="mt-3 overflow-auto rounded-2xl bg-white/80 p-3 text-xs text-slate-700">{widgetSnippet}</pre>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
	                        navigator.clipboard?.writeText(widgetSnippet);
                        setCopyNotice(t("botDetail.widgetCodeCopied"));
                      }}
                    >
                      <Copy size={16} />{t("common.copy")}
                    </Button>
                    <Link to="/app/conversations"><Button type="button" variant="ghost"><ExternalLink size={16} />{t("botDetail.openInbox")}</Button></Link>
                  </div>
                  {copyNotice ? <p className="mt-2 text-xs font-semibold text-brand-700">{copyNotice}</p> : null}
                </div>
                <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  previewMutation.mutate(websiteChannel.public_token);
                }}
              >
                <Input label={t("botDetail.name")} value={preview.full_name} onChange={(event) => setPreview({ ...preview, full_name: event.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label={t("botDetail.phone")} value={preview.phone} onChange={(event) => setPreview({ ...preview, phone: event.target.value })} />
                  <Input label={t("common.email")} value={preview.email} onChange={(event) => setPreview({ ...preview, email: event.target.value })} />
                </div>
                <Textarea label={t("botDetail.message")} value={preview.message} onChange={(event) => setPreview({ ...preview, message: event.target.value })} required />
                <Button type="submit" variant="ai" isLoading={previewMutation.isPending}><Send size={16} />{t("botDetail.createTestConversation")}</Button>
              </form>
              {previewConversationId ? (
                <div className="rounded-3xl border border-slate-100 bg-white/80 p-4">
                  <p className="text-sm font-black text-midnight">{t("botDetail.followUpStepTitle")}</p>
                  <Textarea
                    className="mt-3"
                    value={followUpMessage}
                    onChange={(event) => setFollowUpMessage(event.target.value)}
                  />
                  <Button
                    className="mt-3"
                    type="button"
                    variant="secondary"
                    isLoading={followUpMutation.isPending}
                    disabled={!followUpMessage.trim()}
                    onClick={() => followUpMutation.mutate({ publicToken: websiteChannel.public_token, conversationId: previewConversationId })}
                  >
                    <Send size={16} />{t("botDetail.addFollowUp")}
                  </Button>
                </div>
              ) : null}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                {t("botDetail.addWebsiteFirst")}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-bold text-midnight">{t("botDetail.previewResultTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {t("botDetail.previewResultDescription")}
            </p>
            <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
              {previewResult || t("botDetail.noPreviewMessages")}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-midnight">{t("botDetail.aiReplyTitle")}</h2>
                <p className="text-sm text-slate-500">{t("botDetail.aiReplyDescription")}</p>
              </div>
              <Button
                variant="ai"
                disabled={!latestConversation}
                isLoading={suggestReplyMutation.isPending}
                onClick={() => latestConversation && suggestReplyMutation.mutate(latestConversation.id)}
              >
                <Sparkles size={16} />{t("botDetail.generate")}
              </Button>
            </div>
            {latestConversation ? (
              <div className="space-y-3">
                {latestConversationMessages.length ? latestConversationMessages.map((message) => (
                  <div key={message.id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{message.direction}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{message.text || t("botDetail.emptyMessage")}</p>
                  </div>
                )) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                    {t("botDetail.noMessagesInLatest")}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                {t("botDetail.createConversationFirst")}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-bold text-midnight">{t("botDetail.draftReplyTitle")}</h2>
            <div className="mt-4 rounded-3xl bg-ai-50 p-4 text-sm leading-7 text-ai-900">
              {suggestedReply?.suggested_reply || t("botDetail.draftReplyEmpty")}
            </div>
            {suggestedReply ? (
              <p className="mt-3 text-xs font-semibold text-slate-400">
                {t("botDetail.draftMeta", { id: suggestedReply.log_id, mode: suggestedReply.is_mock ? t("botDetail.mockMode") : t("botDetail.aiMode"), count: suggestedReply.messages_used })}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
