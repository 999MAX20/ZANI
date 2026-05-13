import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot as BotIcon, MessageSquareText, Plus, Radio, Send, Sparkles } from "lucide-react";
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
import type { BotChannel } from "../../types";

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
  const bot = useQuery({
    queryKey: ["bots", botId],
    queryFn: () => botsApi.get(botId),
    enabled: Number.isFinite(botId),
  });

  const addWebsiteChannel = useMutation({
    mutationFn: () => botChannelsApi.create({ bot: botId, channel: "website", status: "draft", external_id: "", config_json: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-channels"] }),
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
          </>
        }
      />
      {addWebsiteChannel.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(addWebsiteChannel.error)} /></div> : null}
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
