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

export function WildberriesInlineSetup({
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
  const [apiToken, setApiToken] = useState("");
  const [entities, setEntities] = useState<string[]>(Array.isArray(connector?.config_json?.entities) ? connector?.config_json?.entities as string[] : ["orders", "sales"]);
  const [syncDays, setSyncDays] = useState(String(connector?.config_json?.sync_days || "7"));
  const [showAccessSetup, setShowAccessSetup] = useState(Boolean(connector?.config_json?.api_token_configured));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["wildberries-status", connector?.id],
    queryFn: () => businessConnectorsApi.wildberriesStatus(Number(connector?.id)),
    enabled: Boolean(connector?.id),
  });

  const saveConfig = useMutation({
    mutationFn: () => businessConnectorsApi.configureWildberries({
      business: businessId,
      apiToken,
      entities,
      syncDays: Number(syncDays || 7),
    }),
    onSuccess: () => {
      setApiToken("");
      setNotice(t("integrations.wildberries.accessSaved"));
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["wildberries-status"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => businessConnectorsApi.wildberriesTestConnection(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("integrations.wildberries.connectionChecked") : data.reason || t("integrations.wildberries.connectionCheckFailed"));
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["wildberries-status", connector?.id] });
    },
  });

  const syncData = useMutation({
    mutationFn: () => businessConnectorsApi.wildberriesSync(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("integrations.wildberries.dataLoaded", { count: data.events.length }) : data.reason || t("integrations.wildberries.dataLoadFailed"));
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["wildberries-status", connector?.id] });
    },
  });

  const toggleEntity = (entity: string) => {
    setEntities((current) => current.includes(entity) ? current.filter((item) => item !== entity) : [...current, entity]);
  };

  const error = saveConfig.error || testConnection.error || syncData.error || status.error;
  const tokenConfigured = Boolean(status.data?.api_token_configured || connector?.config_json?.api_token_configured);

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.setupMetric.access")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{tokenConfigured ? t("integrations.setupMetric.saved") : t("integrations.setupMetric.required")}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.setupMetric.mode")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{t("integrations.setupMetric.readOnly")}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.wildberries.updateWindow")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{t("integrations.wildberries.updateWindowValue")}</p>
        </div>
      </div>

      {!showAccessSetup ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-black text-blue-950">{t("integrations.wildberries.connectionTitle")}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
            {t("integrations.wildberries.connectionDescription")}
          </p>
          <Button type="button" className="mt-3" disabled={!canManage} onClick={() => setShowAccessSetup(true)}>
            <ShieldCheck size={16} /> {t("integrations.setupAction.enterAccessKey")}
          </Button>
        </div>
      ) : (
        <Input
          label={t("integrations.wildberries.accessKey")}
          value={apiToken}
          onChange={(event) => setApiToken(event.target.value)}
          placeholder={tokenConfigured ? t("integrations.setupAction.accessKeyReplacePlaceholder") : t("integrations.wildberries.accessKeyPlaceholder")}
          type="password"
          autoComplete="off"
        />
      )}

      <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? t("integrations.setupAction.hideAdvanced") : t("integrations.setupAction.showAdvanced")}
      </button>
      {showAdvanced ? (
        <div className="space-y-3 rounded-2xl bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["orders", t("integrations.wildberries.entity.orders")],
              ["sales", t("integrations.wildberries.entity.sales")],
              ["stocks", t("integrations.wildberries.entity.stocks")],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={entities.includes(value)} onChange={() => toggleEntity(value)} />
                {label}
              </label>
            ))}
          </div>
          <Input label={t("integrations.setupAction.syncDays")} value={syncDays} onChange={(event) => setSyncDays(event.target.value)} placeholder="7" type="number" />
          {entities.includes("stocks") ? (
            <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
              {t("integrations.wildberries.stocksOptional")}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Button type="button" disabled={!canManage || (!apiToken.trim() && !connector)} isLoading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
          <ShieldCheck size={16} /> {connector ? t("integrations.setupAction.saveAccess") : t("integrations.wildberries.connect")}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <RefreshCw size={16} /> {t("integrations.card.check")}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured || !entities.length} isLoading={syncData.isPending} onClick={() => syncData.mutate()}>
          <DatabaseZap size={16} /> {t("integrations.wildberries.loadData")}
        </Button>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        {t("integrations.wildberries.readOnlyNotice")}
      </p>
    </div>
  );
}
