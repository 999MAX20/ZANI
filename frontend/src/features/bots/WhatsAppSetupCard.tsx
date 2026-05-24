import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, MessageCircle, Radio, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../../api/client";
import { integrationEventLogsApi, whatsappChannelApi } from "../../api/bots";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import type { BotChannel } from "../../types";

type WhatsAppSetupCardProps = {
  channel?: BotChannel;
};

export function WhatsAppSetupCard({ channel }: WhatsAppSetupCardProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    providerMode: ((channel?.config_json?.provider_mode as "mock" | "disabled" | undefined) || "mock"),
    webhookSecret: ((channel?.config_json?.webhook_secret as string | undefined) || ""),
    phoneNumberId: ((channel?.config_json?.phone_number_id as string | undefined) || channel?.external_id || ""),
  });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!channel) return;
    setForm({
      providerMode: ((channel.config_json?.provider_mode as "mock" | "disabled" | undefined) || "mock"),
      webhookSecret: ((channel.config_json?.webhook_secret as string | undefined) || ""),
      phoneNumberId: ((channel.config_json?.phone_number_id as string | undefined) || channel.external_id || ""),
    });
  }, [channel?.id, channel?.external_id, channel?.config_json]);

  const status = useQuery({
    queryKey: ["whatsapp-status", channel?.id],
    queryFn: () => whatsappChannelApi.status(Number(channel?.id)),
    enabled: Boolean(channel?.id),
  });
  const logs = useQuery({
    queryKey: ["integration-event-logs", "whatsapp", channel?.id],
    queryFn: () => integrationEventLogsApi.list({ provider: "whatsapp", channel: "whatsapp" }),
    enabled: Boolean(channel?.id),
  });
  const configMutation = useMutation({
    mutationFn: () =>
      whatsappChannelApi.configure({
        channelId: Number(channel?.id),
        providerMode: form.providerMode,
        webhookSecret: form.webhookSecret,
        phoneNumberId: form.phoneNumberId,
    }),
    onSuccess: (data) => {
      setNotice(t("whatsappSetup.savedNotice", { status: data.status }));
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
    },
  });

  return (
    <Card>
      <CardBody>
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-green-50 text-green-700">
            <MessageCircle size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-midnight">WhatsApp setup</h2>
            <p className="text-sm text-slate-500">{t("whatsappSetup.description")}</p>
          </div>
        </div>

        {configMutation.error || status.error || logs.error ? (
          <div className="mb-4">
            <ErrorState message={getApiErrorMessage(configMutation.error || status.error || logs.error)} />
          </div>
        ) : null}
        {notice ? <div className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-800">{notice}</div> : null}

        {channel ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t("whatsappSetup.providerMode")}
                value={form.providerMode}
                onChange={(event) => setForm((current) => ({ ...current, providerMode: event.target.value as "mock" | "disabled" }))}
                options={[
                  { value: "mock", label: t("whatsappSetup.modeMock") },
                  { value: "disabled", label: t("whatsappSetup.modeDisabled") },
                ]}
              />
              <Input
                label={t("whatsappSetup.phoneNumberId")}
                value={form.phoneNumberId}
                onChange={(event) => setForm((current) => ({ ...current, phoneNumberId: event.target.value }))}
                placeholder="dev-phone-id"
              />
            </div>
            <Input
              label={t("whatsappSetup.webhookSecret")}
              value={form.webhookSecret}
              onChange={(event) => setForm((current) => ({ ...current, webhookSecret: event.target.value }))}
              placeholder={t("common.optional")}
            />
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{t("whatsappSetup.webhookUrl")}</p>
              <p className="mt-2 break-all text-sm font-semibold text-midnight">
                {status.data?.webhook_url || `${import.meta.env.VITE_API_URL || window.location.origin}/api/integrations/whatsapp/webhook/`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => configMutation.mutate()} isLoading={configMutation.isPending}>
                <KeyRound size={16} />{t("whatsappSetup.saveConnection")}
              </Button>
              <Button variant="ghost" onClick={() => status.refetch()} isLoading={status.isFetching}>
                <Radio size={16} />{t("whatsappSetup.checkStatus")}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <HealthPill label={t("whatsappSetup.mode")} value={status.data?.provider_mode === "mock" ? t("whatsappSetup.modeDemo") : status.data?.provider_mode || form.providerMode} />
              <HealthPill label={t("whatsappSetup.protection")} value={status.data?.webhook_secret_configured ? t("whatsappSetup.configured") : t("whatsappSetup.notConfigured")} />
              <HealthPill label={t("whatsappSetup.lastEvent")} value={status.data?.last_event_status || t("whatsappSetup.none")} />
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-slate-500" />
                <p className="text-sm font-bold text-midnight">{t("whatsappSetup.testHistory")}</p>
              </div>
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
                {!logs.isLoading && !(logs.data || []).length ? (
                  <p className="text-sm text-slate-500">{t("whatsappSetup.emptyHistory")}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
            {t("whatsappSetup.noChannel")}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function HealthPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-midnight">{value}</p>
    </div>
  );
}
