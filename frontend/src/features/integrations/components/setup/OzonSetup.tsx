import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap, RefreshCw, ShieldCheck } from "lucide-react";

import { businessConnectorsApi } from "../../../../api/connectors";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { Input } from "../../../../components/ui/Input";
import { useNotification } from "../../../../components/notifications/NotificationProvider";
import { useI18n } from "../../../../lib/i18n";
import type { BusinessConnector, Id } from "../../../../types";
import { merchantSafeIntegrationError } from "../../utils";

export function OzonInlineSetup({
  businessId,
  canManage,
  connector,
}: {
  businessId: Id;
  canManage: boolean;
  connector?: BusinessConnector;
}) {
  const { t } = useI18n();
  const showNotification = useNotification();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [entities, setEntities] = useState<string[]>(Array.isArray(connector?.config_json?.entities) ? connector?.config_json?.entities as string[] : ["fbs_postings", "fbo_postings", "stocks"]);
  const [syncDays, setSyncDays] = useState(String(connector?.config_json?.sync_days || "7"));
  const [limit, setLimit] = useState(String(connector?.config_json?.limit || "50"));
  const [showAccessSetup, setShowAccessSetup] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function setNotice(message: string | null) {
    if (!message) return;
    showNotification({ message, tone: "info" });
  }

  const status = useQuery({
    queryKey: ["ozon-status", connector?.id],
    queryFn: () => businessConnectorsApi.ozonStatus(Number(connector?.id)),
    enabled: Boolean(connector?.id),
  });

  const saveConfig = useMutation({
    mutationFn: () => businessConnectorsApi.configureOzon({
      business: businessId,
      clientId,
      apiKey,
      entities,
      syncDays: Number(syncDays || 7),
      limit: Number(limit || 50),
    }),
    onSuccess: () => {
      setClientId("");
      setApiKey("");
      setNotice(t("integrations.ozon.accessSaved"));
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["ozon-status"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => businessConnectorsApi.ozonTestConnection(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? (data.mock ? t("integrations.mock.connectionChecked") : t("integrations.ozon.connectionChecked")) : data.reason || t("integrations.ozon.connectionCheckFailed"));
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["ozon-status", connector?.id] });
    },
  });

  const syncData = useMutation({
    mutationFn: () => businessConnectorsApi.ozonSync(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? (data.mock ? t("integrations.mock.syncLoaded", { count: data.events.length }) : t("integrations.ozon.dataLoaded", { count: data.events.length })) : data.reason || t("integrations.ozon.dataLoadFailed"));
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["ozon-status", connector?.id] });
    },
  });

  const toggleEntity = (entity: string) => {
    setEntities((current) => current.includes(entity) ? current.filter((item) => item !== entity) : [...current, entity]);
  };

  const error = saveConfig.error || testConnection.error || syncData.error || status.error;
  const accessConfigured = Boolean((status.data?.client_id_configured && status.data?.api_key_configured) || (connector?.config_json?.client_id_configured && connector?.config_json?.api_key_configured));
  const runsInMockMode = status.data ? !status.data.ozon_enabled : false;

  return (
    <div className="w-full space-y-4 rounded-card border border-slate-200 bg-slate-50 p-4">
      {error ? <ErrorState message={merchantSafeIntegrationError(getApiErrorMessage(error), t)} /> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.setupMetric.access")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{accessConfigured ? t("integrations.setupMetric.saved") : t("integrations.setupMetric.required")}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.setupMetric.mode")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{runsInMockMode ? t("integrations.setupMetric.demoReadOnly") : t("integrations.setupMetric.readOnly")}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.ozon.data")}</p>
          <p className="mt-1 text-sm font-black text-midnight">FBS/FBO/stock</p>
        </div>
      </div>
      {runsInMockMode ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
          {t("integrations.mock.providerDisabledNotice")}
        </div>
      ) : null}

      {!showAccessSetup ? (
        <div className="rounded-card border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-black text-blue-950">{t("integrations.ozon.connectionTitle")}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
            {t("integrations.ozon.connectionDescription")}
          </p>
          <Button type="button" className="mt-3" disabled={!canManage} onClick={() => setShowAccessSetup(true)}>
            <ShieldCheck size={16} /> {t("integrations.ozon.enterAccess")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label={t("integrations.ozon.sellerId")}
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder={accessConfigured ? t("integrations.ozon.sellerIdReplacePlaceholder") : t("integrations.ozon.sellerIdPlaceholder")}
            type="password"
            autoComplete="off"
          />
          <Input
            label={t("integrations.ozon.accessKey")}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={accessConfigured ? t("integrations.setupAction.accessKeyReplacePlaceholder") : t("integrations.ozon.accessKeyPlaceholder")}
            type="password"
            autoComplete="off"
          />
        </div>
      )}

      <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? t("integrations.setupAction.hideAdvanced") : t("integrations.setupAction.showAdvanced")}
      </button>
      {showAdvanced ? (
        <div className="space-y-3 rounded-2xl bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["fbs_postings", "FBS"],
              ["fbo_postings", "FBO"],
              ["stocks", t("integrations.ozon.entity.stocks")],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={entities.includes(value)} onChange={() => toggleEntity(value)} />
                {label}
              </label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label={t("integrations.setupAction.syncDays")} value={syncDays} onChange={(event) => setSyncDays(event.target.value)} placeholder="7" type="number" />
            <Input label={t("integrations.ozon.limit")} value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="50" type="number" />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {showAccessSetup || showAdvanced ? (
          <Button type="button" disabled={!canManage || ((!clientId.trim() || !apiKey.trim()) && !connector)} isLoading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
            <ShieldCheck size={16} /> {connector ? t("integrations.setupAction.saveAccess") : t("integrations.ozon.connect")}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !accessConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <RefreshCw size={16} /> {t("integrations.card.check")}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !accessConfigured || !entities.length} isLoading={syncData.isPending} onClick={() => syncData.mutate()}>
          <DatabaseZap size={16} /> {t("integrations.ozon.loadData")}
        </Button>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        {t("integrations.ozon.readOnlyNotice")}
      </p>
    </div>
  );
}
