import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Link2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { botChannelsApi, botsApi, telegramChannelApi } from "../../../../api/bots";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { Input } from "../../../../components/ui/Input";
import { cn } from "../../../../lib/cn";
import type { Bot, BotChannel, Id } from "../../../../types";
import { LogoMark, ToggleSwitch } from "./IntegrationSetupUi";

export function TelegramInlineSetup({
  businessId,
  bots,
  canManage,
  channel,
}: {
  businessId: Id;
  bots: Bot[];
  canManage: boolean;
  channel?: BotChannel;
}) {
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["telegram-status", channel?.id],
    queryFn: () => telegramChannelApi.status(Number(channel?.id)),
    enabled: Boolean(channel?.id),
  });

  const ensureChannel = useMutation({
    mutationFn: async () => {
      const bot = bots[0] || await botsApi.create({
        business: businessId,
        name: "Telegram bot",
        status: "active",
        default_language: "ru",
        settings_json: {},
      });
      return botChannelsApi.create({
        bot: bot.id,
        channel: "telegram",
        status: "draft",
        external_id: "",
        config_json: {},
      });
    },
    onSuccess: () => {
      setNotice("Telegram channel создан. Теперь вставьте BotFather token.");
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
    },
  });

  const saveToken = useMutation({
    mutationFn: () => telegramChannelApi.configure({ channelId: Number(channel?.id), botToken }),
    onSuccess: () => {
      setBotToken("");
      setNotice("Token сохранен. Проверьте token и подключите webhook.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => telegramChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "Token проверен." : data.reason || "Token не прошел проверку.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const setWebhook = useMutation({
    mutationFn: async () => {
      const current = status.data || await telegramChannelApi.status(Number(channel?.id));
      return telegramChannelApi.setWebhook({ channelId: Number(channel?.id), webhookUrl: current.webhook_url });
    },
    onSuccess: (data) => {
      setNotice(data.ok ? "Webhook подключен. Напишите сообщение боту и проверьте Inbox." : data.reason || "Webhook не подключен.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["integration-event-logs"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });
  const toggleChannel = useMutation({
    mutationFn: (nextStatus: BotChannel["status"]) => {
      if (!channel) throw new Error("Channel is required.");
      return botChannelsApi.update({ id: channel.id, payload: { status: nextStatus } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const error = ensureChannel.error || saveToken.error || testConnection.error || setWebhook.error || toggleChannel.error || status.error;
  const tokenConfigured = Boolean(status.data?.token_configured);
  const tokenVerified = Boolean(status.data?.token_verified);
  const webhookConfigured = Boolean(status.data?.webhook_configured);
  const webhookPublicReady = Boolean(status.data?.webhook_public_ready);
  const inboundReady = Boolean(status.data?.inbound_ready);
  const canSaveToken = botToken.trim().length >= 9;

  if (!channel) {
    return (
      <div className="w-full space-y-3">
        {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}
        <Button type="button" disabled={!canManage} isLoading={ensureChannel.isPending} onClick={() => ensureChannel.mutate()}>
          <Send size={16} /> Создать Telegram channel
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <LogoMark logo="/integrations_logos/telegram.png" label="Telegram" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-midnight">Telegram</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Вставьте token бота мерчанта из BotFather. ZANI проверит доступ и подключит входящие сообщения.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-midnight">1. Доступ к боту</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{tokenConfigured ? "Token сохранен приватно." : "Нужен token, который выдал BotFather."}</p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-black", tokenVerified ? "bg-emerald-50 text-emerald-700" : tokenConfigured ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500")}>
            {tokenVerified ? "Проверено" : tokenConfigured ? "Сохранено" : "Не подключено"}
          </span>
        </div>
        <Input
          label={tokenConfigured ? "BotFather token сохранен приватно" : "BotFather token"}
          value={botToken}
          onChange={(event) => setBotToken(event.target.value)}
          placeholder={tokenConfigured ? "Token уже сохранен. Вставьте новый только для замены." : "123456789:AA..."}
          type="password"
          autoComplete="off"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {canSaveToken ? (
            <Button type="button" disabled={!canManage} isLoading={saveToken.isPending} onClick={() => saveToken.mutate()}>
              <ShieldCheck size={16} /> {tokenConfigured ? "Заменить token" : "Сохранить token"}
            </Button>
          ) : null}
          {tokenConfigured && !canSaveToken ? (
            <Button type="button" variant={tokenVerified ? "secondary" : "primary"} disabled={!canManage || tokenVerified} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
              {tokenVerified ? <CheckCircle2 size={16} /> : <RefreshCw size={16} />} {tokenVerified ? "Проверено" : "Проверить подключение"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-midnight">2. Входящие сообщения</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              {webhookConfigured ? "Входящие сообщения подключены." : "После проверки token подключите прием сообщений в Inbox."}
            </p>
          </div>
          <Button type="button" disabled={!canManage || !tokenVerified || webhookConfigured || setWebhook.isPending || status.isFetching} isLoading={setWebhook.isPending} onClick={() => setWebhook.mutate()}>
            <CheckCircle2 size={16} /> {webhookConfigured ? "Подключено" : "Подключить входящие"}
          </Button>
        </div>
        {!webhookPublicReady ? (
          <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
            Для приема сообщений нужен публичный HTTPS-домен backend. После подключения Telegram будет доставлять сообщения прямо в Inbox.
          </p>
        ) : null}
      </div>

      {webhookConfigured ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-midnight">Канал включен</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{channel.status === "active" ? "Бот принимает и отправляет сообщения." : "Канал на паузе. Включите, когда будете готовы."}</p>
            </div>
            <ToggleSwitch
              checked={channel.status === "active"}
              disabled={!canManage}
              isLoading={toggleChannel.isPending}
              label="Включить или выключить Telegram"
              onChange={(checked) => toggleChannel.mutate(checked ? "active" : "paused")}
            />
          </div>
        </div>
      ) : null}

      <div className={cn("rounded-2xl px-4 py-3 text-xs font-semibold leading-5", inboundReady ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-600")}>
        {inboundReady ? "Telegram готов принимать реальные входящие сообщения." : "После подключения отправьте сообщение боту и проверьте, что диалог появился в Inbox."}
      </div>
    </div>
  );
}
