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

type TelegramSetupCardProps = {
  channel?: BotChannel;
};

export function TelegramSetupCard({ channel }: TelegramSetupCardProps) {
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
      setNotice(data.token_configured ? "Token сохранен. Теперь проверьте подключение." : "Token очищен.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => telegramChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "Telegram token проверен." : data.reason || "Telegram token не прошел проверку.");
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
            <p className="text-sm text-slate-500">Подключение бота мерчанта к Inbox и AI pipeline.</p>
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
              <HealthPill label="Token" value={status.data?.token_configured ? "Сохранен" : "Нужен"} good={status.data?.token_configured} />
              <HealthPill label="Secret" value={status.data?.webhook_secret_configured ? "Готов" : "Создастся"} good={status.data?.webhook_secret_configured} />
              <HealthPill label="Webhook" value={status.data?.webhook_configured ? "Подключен" : "Не подключен"} good={status.data?.webhook_configured} />
            </div>

            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-950">BotFather token</p>
              <p className="mt-1 text-sm leading-6 text-blue-900">
                Создайте бота в @BotFather, вставьте token сюда и запустите проверку. Token не будет показан повторно.
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <Input
                  value={botToken}
                  onChange={(event) => setBotToken(event.target.value)}
                  placeholder="123456789:AA..."
                  type="password"
                  autoComplete="off"
                />
                <Button type="button" disabled={!canSave} isLoading={saveToken.isPending} onClick={() => saveToken.mutate()}>
                  <ShieldCheck size={16} /> Сохранить
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => testConnection.mutate()} isLoading={testConnection.isPending} disabled={!status.data?.token_configured}>
                <Radio size={16} /> Проверить token
              </Button>
              <Button type="button" onClick={() => setWebhook.mutate()} isLoading={setWebhook.isPending || status.isFetching} disabled={!status.data?.token_configured}>
                <CheckCircle2 size={16} /> Подключить webhook
              </Button>
              <Button type="button" variant="ghost" onClick={() => status.refetch()} isLoading={status.isFetching}>
                <Radio size={16} /> Статус
              </Button>
              <Link to="/dashboard/conversations?channel=telegram">
                <Button type="button" variant="ghost">
                  <ExternalLink size={16} /> Inbox
                </Button>
              </Link>
            </div>

            {isReady ? (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                Telegram готов. Отправьте сообщение боту от лица клиента и проверьте входящий диалог в Inbox.
              </div>
            ) : null}

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="mb-3 text-sm font-bold text-midnight">Последние события</p>
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
                {!logs.isLoading && !(logs.data || []).length ? <p className="text-sm text-slate-500">Событий пока нет.</p> : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
            Сначала добавьте Telegram channel для этого бота.
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
