import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Radio, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "../../api/client";
import { integrationEventLogsApi, telegramChannelApi } from "../../api/bots";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ErrorState } from "../../components/ui/StateViews";
import type { BotChannel } from "../../types";
import { useI18n } from "../../lib/i18n";

type TelegramSetupCardProps = {
  channel?: BotChannel;
};

export function TelegramSetupCard({ channel }: TelegramSetupCardProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["telegram-status", channel?.id],
    queryFn: () => telegramChannelApi.status(Number(channel?.id)),
    enabled: Boolean(channel?.id),
  });
  const logs = useQuery({
    queryKey: ["integration-event-logs", "telegram", channel?.id],
    queryFn: () => integrationEventLogsApi.list({ provider: "telegram", channel: "telegram" }),
    enabled: Boolean(channel?.id),
  });

  const saveToken = useMutation({
    mutationFn: () => telegramChannelApi.configure({ channelId: Number(channel?.id), botToken }),
    onSuccess: (data) => {
      setBotToken("");
      setNotice(data.token_configured ? t("telegramSetup.tokenSaved") : t("telegramSetup.tokenCleared"));
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => telegramChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("telegramSetup.connectionChecked") : data.reason || t("telegramSetup.connectionFailed"));
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
      setNotice(data.ok ? t("telegramSetup.inboxConnected") : data.reason || t("telegramSetup.inboxFailed"));
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["integration-event-logs"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const error = saveToken.error || testConnection.error || setWebhook.error || status.error || logs.error;
  const canSave = Boolean(channel?.id) && botToken.trim().length > 8;
  const isReady = Boolean(status.data?.token_configured && status.data?.webhook_secret_configured && status.data?.webhook_configured);

  return (
    <Card>
      <CardBody>
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <Send size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-midnight">Telegram</h2>
            <p className="text-sm text-slate-500">{t("telegramSetup.description")}</p>
          </div>
        </div>

        {error ? (
          <div className="mb-4">
            <ErrorState message={getApiErrorMessage(error)} />
          </div>
        ) : null}
        {notice ? <div className="mb-4 rounded-2xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">{notice}</div> : null}

        {channel ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <HealthPill label={t("telegramSetup.key")} value={status.data?.token_configured ? t("telegramSetup.saved") : t("telegramSetup.needed")} good={status.data?.token_configured} />
              <HealthPill label={t("telegramSetup.protection")} value={status.data?.webhook_secret_configured ? t("telegramSetup.ready") : t("telegramSetup.willConfigure")} good={status.data?.webhook_secret_configured} />
              <HealthPill label={t("telegramSetup.inbox")} value={status.data?.webhook_configured ? t("telegramSetup.connected") : t("telegramSetup.notConnected")} good={status.data?.webhook_configured} />
            </div>

            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-950">{t("telegramSetup.botKey")}</p>
              <p className="mt-1 text-sm leading-6 text-blue-900">
                {t("telegramSetup.botKeyText")}
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <Input
                  value={botToken}
                  onChange={(event) => setBotToken(event.target.value)}
                  placeholder={t("telegramSetup.botKeyPlaceholder")}
                  type="password"
                  autoComplete="off"
                />
                <Button type="button" disabled={!canSave} isLoading={saveToken.isPending} onClick={() => saveToken.mutate()}>
                  <ShieldCheck size={16} /> {t("common.save")}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => testConnection.mutate()} isLoading={testConnection.isPending} disabled={!status.data?.token_configured}>
                <Radio size={16} /> {t("telegramSetup.checkKey")}
              </Button>
              <Button type="button" onClick={() => setWebhook.mutate()} isLoading={setWebhook.isPending || status.isFetching} disabled={!status.data?.token_configured}>
                <CheckCircle2 size={16} /> {t("telegramSetup.connectInbox")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => status.refetch()} isLoading={status.isFetching}>
                <Radio size={16} /> {t("pricing.status")}
              </Button>
              <Link to="/dashboard/conversations?channel=telegram">
                <Button type="button" variant="ghost">
                  <ExternalLink size={16} /> {t("nav.conversations")}
                </Button>
              </Link>
            </div>

            {isReady ? (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                {t("telegramSetup.readyNotice")}
              </div>
            ) : null}

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="mb-3 text-sm font-bold text-midnight">{t("telegramSetup.latestEvents")}</p>
              <div className="space-y-2">
                {(logs.data || []).slice(0, 5).map((log) => (
                  <div key={log.id} className="rounded-2xl bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-midnight">{log.direction} · {log.status}</span>
                      <span className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.error ? <p className="mt-1 text-xs font-semibold text-red-600">{log.error}</p> : null}
                  </div>
                ))}
                {!logs.isLoading && !(logs.data || []).length ? <p className="text-sm text-slate-500">{t("telegramSetup.noEvents")}</p> : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
            {t("telegramSetup.addChannelFirst")}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function HealthPill({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={good ? "mt-1 text-sm font-bold text-emerald-700" : "mt-1 text-sm font-bold text-midnight"}>{value}</p>
    </div>
  );
}
