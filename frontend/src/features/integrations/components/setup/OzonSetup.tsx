import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap, RefreshCw, ShieldCheck } from "lucide-react";

import { businessConnectorsApi } from "../../../../api/connectors";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { Input } from "../../../../components/ui/Input";
import { useI18n } from "../../../../lib/i18n";
import type { BusinessConnector, Id } from "../../../../types";

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
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [entities, setEntities] = useState<string[]>(Array.isArray(connector?.config_json?.entities) ? connector?.config_json?.entities as string[] : ["fbs_postings", "fbo_postings", "stocks"]);
  const [syncDays, setSyncDays] = useState(String(connector?.config_json?.sync_days || "7"));
  const [limit, setLimit] = useState(String(connector?.config_json?.limit || "50"));
  const [showAccessSetup, setShowAccessSetup] = useState(Boolean(connector?.config_json?.client_id_configured && connector?.config_json?.api_key_configured));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
      setNotice(data.ok ? t("integrations.ozon.connectionChecked") : data.reason || t("integrations.ozon.connectionCheckFailed"));
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["ozon-status", connector?.id] });
    },
  });

  const syncData = useMutation({
    mutationFn: () => businessConnectorsApi.ozonSync(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("integrations.ozon.dataLoaded", { count: data.events.length }) : data.reason || t("integrations.ozon.dataLoadFailed"));
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

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.setupMetric.access")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{accessConfigured ? t("integrations.setupMetric.saved") : t("integrations.setupMetric.required")}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.setupMetric.mode")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{t("integrations.setupMetric.readOnly")}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.ozon.data")}</p>
          <p className="mt-1 text-sm font-black text-midnight">FBS/FBO/stock</p>
        </div>
      </div>

      {!showAccessSetup ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
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
              <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
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
        <Button type="button" disabled={!canManage || ((!clientId.trim() || !apiKey.trim()) && !connector)} isLoading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
          <ShieldCheck size={16} /> {connector ? t("integrations.setupAction.saveAccess") : t("integrations.ozon.connect")}
        </Button>
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
