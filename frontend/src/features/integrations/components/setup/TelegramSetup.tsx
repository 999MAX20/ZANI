import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw, Send, ShieldCheck } from "lucide-react";

import { botChannelsApi, botsApi, telegramChannelApi } from "../../../../api/bots";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { Input } from "../../../../components/ui/Input";
import { useI18n } from "../../../../lib/i18n";
import type { Bot, BotChannel, Id } from "../../../../types";
import { MessengerSetupShell } from "./IntegrationSetupUi";

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
  const { t } = useI18n();
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
      setNotice(t("integrations.telegram.channelCreated"));
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
    },
  });

  const saveToken = useMutation({
    mutationFn: () => telegramChannelApi.configure({ channelId: Number(channel?.id), botToken }),
    onSuccess: () => {
      setBotToken("");
      setNotice(t("integrations.telegram.tokenSavedNotice"));
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => telegramChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("integrations.telegram.connectionChecked") : data.reason || t("integrations.telegram.connectionCheckFailed"));
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
      setNotice(data.ok ? t("integrations.telegram.inboundConnected") : data.reason || t("integrations.telegram.inboundConnectFailed"));
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
  const inboundReady = Boolean(status.data?.inbound_ready);
  const canSaveToken = botToken.trim().length >= 9;
  const connectionStatus = inboundReady || webhookConfigured
    ? t("integrations.status.connected")
    : tokenConfigured
      ? t("integrations.status.providerConfiguring")
      : t("integrations.status.notConnected");
  const connectionTone = inboundReady ? "success" : tokenVerified || tokenConfigured ? "progress" : "neutral";

  if (!channel) {
    return (
      <div className="w-full space-y-3">
        {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}
        <Button type="button" disabled={!canManage} isLoading={ensureChannel.isPending} onClick={() => ensureChannel.mutate()}>
          <Send size={16} /> {t("integrations.telegram.createChannel")}
        </Button>
      </div>
    );
  }

  return (
    <MessengerSetupShell
      logo="/integrations_logos/telegram.png"
      title="Telegram"
      description={t("integrations.telegram.inlineDescription")}
      status={connectionStatus}
      statusTone={connectionTone}
      notice={notice}
      error={error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      canManage={canManage}
      inboxChannel="telegram"
      channelToggleVisible={webhookConfigured}
      channelEnabled={channel.status === "active"}
      channelToggleLoading={toggleChannel.isPending}
      onToggleChannel={(checked) => toggleChannel.mutate(checked ? "active" : "paused")}
    >
      {!webhookConfigured ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-black text-midnight">{t("integrations.telegram.botKey")}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {tokenConfigured ? t("integrations.telegram.tokenSavedPrivate") : t("integrations.telegram.tokenInstruction")}
            </p>
          </div>
          <Input
            label=""
            value={botToken}
            onChange={(event) => setBotToken(event.target.value)}
            placeholder={tokenConfigured ? t("integrations.telegram.tokenReplacePlaceholder") : t("integrations.telegram.tokenInputPlaceholder")}
            type="password"
            autoComplete="off"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {canSaveToken ? (
              <Button type="button" disabled={!canManage} isLoading={saveToken.isPending} onClick={() => saveToken.mutate()}>
                <ShieldCheck size={16} /> {t("integrations.telegram.saveKey")}
              </Button>
            ) : null}
            {tokenConfigured && !tokenVerified && !canSaveToken ? (
              <Button type="button" disabled={!canManage} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
                <RefreshCw size={16} /> {t("integrations.telegram.testConnection")}
              </Button>
            ) : null}
            {tokenVerified ? (
              <Button type="button" disabled={!canManage || setWebhook.isPending || status.isFetching} isLoading={setWebhook.isPending} onClick={() => setWebhook.mutate()}>
                <CheckCircle2 size={16} /> {t("integrations.telegram.connectInbound")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </MessengerSetupShell>
  );
}
