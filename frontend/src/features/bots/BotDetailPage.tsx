import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot as BotIcon, KeyRound, MessageSquareText, Plus, Radio, Send, ShieldCheck, Sparkles, Webhook } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { botAiApi, botChannelsApi, botsApi, telegramChannelApi, websiteChatApi, type BotSuggestedReplyResponse } from "../../api/bots";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useEntityData } from "../../hooks/useEntityData";
import type { BotChannel } from "../../types";
import { WhatsAppSetupCard } from "./WhatsAppSetupCard";

const channelLabels: Record<BotChannel["channel"], string> = {
  website: "Website chat",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

export function BotDetailPage() {
  const params = useParams();
  const botId = Number(params.id);
  const queryClient = useQueryClient();
  const { botChannels, botConversations, botMessages } = useEntityData();
  const [preview, setPreview] = useState({
    full_name: "Тестовый посетитель",
    phone: "+77010000000",
    email: "",
    message: "Здравствуйте, хочу записаться на консультацию.",
  });
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [suggestedReply, setSuggestedReply] = useState<BotSuggestedReplyResponse | null>(null);
  const [telegramForm, setTelegramForm] = useState({
    botToken: "",
    webhookSecret: "",
    webhookUrl: `${import.meta.env.VITE_API_URL || window.location.origin}/api/integrations/telegram/webhook/`,
  });
  const [telegramNotice, setTelegramNotice] = useState<string | null>(null);
  const bot = useQuery({
    queryKey: ["bots", botId],
    queryFn: () => botsApi.get(botId),
    enabled: Number.isFinite(botId),
  });

  const addWebsiteChannel = useMutation({
    mutationFn: () => botChannelsApi.create({ bot: botId, channel: "website", status: "draft", external_id: "", config_json: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-channels"] }),
  });
  const addTelegramChannel = useMutation({
    mutationFn: () => botChannelsApi.create({ bot: botId, channel: "telegram", status: "draft", external_id: "", config_json: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-channels"] }),
  });
  const addWhatsAppChannel = useMutation({
    mutationFn: () => botChannelsApi.create({ bot: botId, channel: "whatsapp", status: "draft", external_id: "", config_json: { provider_mode: "mock" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-channels"] }),
  });
  const telegramConfigMutation = useMutation({
    mutationFn: (channelId: number) =>
      telegramChannelApi.configure({
        channelId,
        botToken: telegramForm.botToken,
        webhookSecret: telegramForm.webhookSecret,
      }),
    onSuccess: (data) => {
      setTelegramNotice(`Telegram config saved. Token: ${data.token_configured ? "configured" : "missing"}.`);
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
    },
  });
  const telegramWebhookMutation = useMutation({
    mutationFn: (channelId: number) => telegramChannelApi.setWebhook({ channelId, webhookUrl: telegramForm.webhookUrl }),
    onSuccess: (data) => setTelegramNotice(data.mock ? `Webhook mock set: ${data.reason}` : "Webhook set."),
  });
  const telegramStatusMutation = useMutation({
    mutationFn: (channelId: number) => telegramChannelApi.status(channelId),
    onSuccess: (data) =>
      setTelegramNotice(
        `Status: ${data.status}. Token: ${data.token_configured ? "configured" : "missing"}. Last error: ${data.last_error || "none"}.`,
      ),
  });
  const previewMutation = useMutation({
    mutationFn: (publicToken: string) => websiteChatApi.createConversation({ publicToken, payload: preview }),
    onSuccess: (data) => {
      setPreviewResult(`Conversation ${data.conversation_id} создана. Lead: ${data.lead_id || "не создан"}.`);
      queryClient.invalidateQueries({ queryKey: ["bot-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["bot-messages"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
  const suggestReplyMutation = useMutation({
    mutationFn: (conversationId: number) => botAiApi.suggestReply(conversationId),
    onSuccess: (data) => setSuggestedReply(data),
  });

  if (bot.isLoading || botChannels.isLoading || botConversations.isLoading || botMessages.isLoading) return <LoadingState />;
  if (bot.error) return <ErrorState message={getApiErrorMessage(bot.error)} />;
  if (!bot.data) return <ErrorState message="Бот не найден или недоступен." />;

  const channels = (botChannels.data || []).filter((channel) => channel.bot === bot.data.id);
  const websiteChannel = channels.find((channel) => channel.channel === "website");
  const telegramChannel = channels.find((channel) => channel.channel === "telegram");
  const whatsappChannel = channels.find((channel) => channel.channel === "whatsapp");
  const conversations = (botConversations.data || []).filter((conversation) => conversation.bot === bot.data.id);
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  const messages = (botMessages.data || []).filter((message) => conversationIds.has(message.conversation));
  const latestConversation = conversations[0];
  const latestConversationMessages = latestConversation
    ? messages.filter((message) => message.conversation === latestConversation.id).slice(-6)
    : [];

  return (
    <>
      <PageHeader
        title={bot.data.name}
        description="Placeholder настройки бота. Реальные webhook, AI-ответы и виджет будут подключаться следующими этапами."
        actions={
          <>
            <Link to="/dashboard/bots"><Button variant="secondary"><ArrowLeft size={16} />Назад</Button></Link>
            <Button
              variant="ai"
              onClick={() => addWebsiteChannel.mutate()}
              isLoading={addWebsiteChannel.isPending}
              disabled={Boolean(websiteChannel)}
            >
              <Plus size={16} />Website channel
            </Button>
            <Button
              variant="secondary"
              onClick={() => addTelegramChannel.mutate()}
              isLoading={addTelegramChannel.isPending}
              disabled={Boolean(telegramChannel)}
            >
              <Plus size={16} />Telegram channel
            </Button>
            <Button
              variant="secondary"
              onClick={() => addWhatsAppChannel.mutate()}
              isLoading={addWhatsAppChannel.isPending}
              disabled={Boolean(whatsappChannel)}
            >
              <Plus size={16} />WhatsApp channel
            </Button>
          </>
        }
      />
      {addWebsiteChannel.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(addWebsiteChannel.error)} /></div> : null}
      {addTelegramChannel.error || telegramConfigMutation.error || telegramWebhookMutation.error || telegramStatusMutation.error ? (
        <div className="mb-4"><ErrorState message={getApiErrorMessage(addTelegramChannel.error || telegramConfigMutation.error || telegramWebhookMutation.error || telegramStatusMutation.error)} /></div>
      ) : null}
      {addWhatsAppChannel.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(addWhatsAppChannel.error)} /></div> : null}
      {previewMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(previewMutation.error)} /></div> : null}
      {suggestReplyMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(suggestReplyMutation.error)} /></div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                <BotIcon size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-midnight">Bot profile</h2>
                <p className="text-sm text-slate-500">Language: {bot.data.default_language.toUpperCase()}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <span className="text-sm font-semibold text-slate-600">Status</span>
                <StatusBadge status={bot.data.status} />
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <span className="text-sm font-semibold text-slate-600">Channels</span>
                <span className="font-bold text-midnight">{channels.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <span className="text-sm font-semibold text-slate-600">Messages</span>
                <span className="font-bold text-midnight">{messages.length}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-midnight">Channels</h2>
                <p className="text-sm text-slate-500">Токены и секреты будут храниться в `config_json`, не в `.env`.</p>
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
                      <p className="font-semibold text-midnight">{channelLabels[channel.channel]}</p>
                      <p className="text-sm text-slate-500">{channel.external_id || "External ID не задан"}</p>
                      {channel.channel === "website" ? (
                        <p className="mt-1 break-all text-xs font-semibold text-brand-700">Token: {channel.public_token}</p>
                      ) : null}
                    </div>
                  </div>
                  <StatusBadge status={channel.status} />
                </div>
              ))}
              {!channels.length ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
                  Каналов пока нет. Добавьте website channel как безопасный placeholder.
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                <Webhook size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-midnight">Telegram beta setup</h2>
                <p className="text-sm text-slate-500">Token хранится в channel config, в логах показываем только факт настройки.</p>
              </div>
            </div>
            {telegramNotice ? <div className="mb-4 rounded-2xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">{telegramNotice}</div> : null}
            {telegramChannel ? (
              <div className="space-y-4">
                <Input
                  label="Bot token"
                  type="password"
                  value={telegramForm.botToken}
                  onChange={(event) => setTelegramForm({ ...telegramForm, botToken: event.target.value })}
                  placeholder="123456:ABC..."
                />
                <Input
                  label="Webhook secret"
                  value={telegramForm.webhookSecret}
                  onChange={(event) => setTelegramForm({ ...telegramForm, webhookSecret: event.target.value })}
                  placeholder="merchant-secret"
                />
                <Input
                  label="Webhook URL"
                  value={telegramForm.webhookUrl}
                  onChange={(event) => setTelegramForm({ ...telegramForm, webhookUrl: event.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => telegramConfigMutation.mutate(telegramChannel.id)} isLoading={telegramConfigMutation.isPending}>
                    <KeyRound size={16} />Save config
                  </Button>
                  <Button variant="ai" onClick={() => telegramWebhookMutation.mutate(telegramChannel.id)} isLoading={telegramWebhookMutation.isPending}>
                    <ShieldCheck size={16} />Set webhook
                  </Button>
                  <Button variant="ghost" onClick={() => telegramStatusMutation.mutate(telegramChannel.id)} isLoading={telegramStatusMutation.isPending}>
                    <Radio size={16} />Check status
                  </Button>
                </div>
                <p className="text-xs leading-5 text-slate-500">Status check не раскрывает полный token и показывает только last error из provider logs.</p>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                Добавьте Telegram channel, чтобы настроить token и webhook.
              </div>
            )}
          </CardBody>
        </Card>

        <WhatsAppSetupCard channel={whatsappChannel} />

        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <MessageSquareText size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-midnight">Website chat preview</h2>
                <p className="text-sm text-slate-500">Отправляет тестовое сообщение через public API без авторизации.</p>
              </div>
            </div>
            {websiteChannel ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  previewMutation.mutate(websiteChannel.public_token);
                }}
              >
                <Input label="Имя" value={preview.full_name} onChange={(event) => setPreview({ ...preview, full_name: event.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Телефон" value={preview.phone} onChange={(event) => setPreview({ ...preview, phone: event.target.value })} />
                  <Input label="Email" value={preview.email} onChange={(event) => setPreview({ ...preview, email: event.target.value })} />
                </div>
                <Textarea label="Сообщение" value={preview.message} onChange={(event) => setPreview({ ...preview, message: event.target.value })} required />
                <Button type="submit" variant="ai" isLoading={previewMutation.isPending}><Send size={16} />Отправить тест</Button>
              </form>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                Сначала добавьте website channel. После этого здесь появится форма тестового сообщения.
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-bold text-midnight">Preview result</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Если в тестовом сообщении указан телефон или email, backend создаёт клиента и заявку со source `website`.
            </p>
            <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
              {previewResult || "Пока тестовых сообщений не было."}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-midnight">AI suggested reply</h2>
                <p className="text-sm text-slate-500">Генерация черновика по последнему bot conversation. Ответ не отправляется автоматически.</p>
              </div>
              <Button
                variant="ai"
                disabled={!latestConversation}
                isLoading={suggestReplyMutation.isPending}
                onClick={() => latestConversation && suggestReplyMutation.mutate(latestConversation.id)}
              >
                <Sparkles size={16} />Сгенерировать
              </Button>
            </div>
            {latestConversation ? (
              <div className="space-y-3">
                {latestConversationMessages.length ? latestConversationMessages.map((message) => (
                  <div key={message.id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{message.direction}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{message.text || "Empty message"}</p>
                  </div>
                )) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                    В последнем диалоге пока нет сообщений.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                Сначала создайте тестовый website conversation или получите сообщение из канала.
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-bold text-midnight">Draft reply</h2>
            <div className="mt-4 rounded-3xl bg-ai-50 p-4 text-sm leading-7 text-ai-900">
              {suggestedReply?.suggested_reply || "Здесь появится AI-черновик ответа. Он не будет отправлен клиенту без подтверждения менеджера."}
            </div>
            {suggestedReply ? (
              <p className="mt-3 text-xs font-semibold text-slate-400">
                log #{suggestedReply.log_id} · {suggestedReply.model} · {suggestedReply.is_mock ? "mock" : `${suggestedReply.tokens_used} tokens`} · messages: {suggestedReply.messages_used}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
