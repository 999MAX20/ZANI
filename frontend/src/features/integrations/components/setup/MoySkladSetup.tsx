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

export function MoySkladInlineSetup({
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
  const [accessToken, setAccessToken] = useState("");
  const [entities, setEntities] = useState<string[]>(Array.isArray(connector?.config_json?.entities) ? connector?.config_json?.entities as string[] : ["products", "stock", "sales", "clients"]);
  const [pageSize, setPageSize] = useState(String(connector?.config_json?.page_size || "50"));
  const [showAccessSetup, setShowAccessSetup] = useState(Boolean(connector?.config_json?.access_token_configured));
  const [showAdvanced, setShowAdvanced] = useState(false);

  function setNotice(message: string | null) {
    if (!message) return;
    showNotification({ message, tone: "info" });
  }

  const status = useQuery({
    queryKey: ["moysklad-status", connector?.id],
    queryFn: () => businessConnectorsApi.moyskladStatus(Number(connector?.id)),
    enabled: Boolean(connector?.id),
  });

  const saveConfig = useMutation({
    mutationFn: () => businessConnectorsApi.configureMoySklad({
      business: businessId,
      accessToken,
      entities,
      pageSize: Number(pageSize || 50),
    }),
    onSuccess: () => {
      setAccessToken("");
      setNotice(t("integrations.moysklad.accessSaved"));
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["moysklad-status"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => businessConnectorsApi.moyskladTestConnection(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("integrations.moysklad.connectionChecked") : data.reason || t("integrations.moysklad.connectionCheckFailed"));
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["moysklad-status", connector?.id] });
    },
  });

  const syncData = useMutation({
    mutationFn: () => businessConnectorsApi.moyskladSync(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("integrations.moysklad.dataLoaded", { count: data.events.length }) : data.reason || t("integrations.moysklad.dataLoadFailed"));
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["moysklad-status", connector?.id] });
    },
  });

  const toggleEntity = (entity: string) => {
    setEntities((current) => current.includes(entity) ? current.filter((item) => item !== entity) : [...current, entity]);
  };

  const error = saveConfig.error || testConnection.error || syncData.error || status.error;
  const tokenConfigured = Boolean(status.data?.access_token_configured || connector?.config_json?.access_token_configured);

  return (
    <div className="w-full space-y-4 rounded-card border border-slate-200 bg-slate-50 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}

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
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.moysklad.inventory")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.last_sync_at ? t("integrations.moysklad.loadedBefore") : t("integrations.setupMetric.notYet")}</p>
        </div>
      </div>

      {!showAccessSetup ? (
        <div className="rounded-card border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-black text-blue-950">{t("integrations.moysklad.connectionTitle")}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
            {t("integrations.moysklad.connectionDescription")}
          </p>
          <Button type="button" className="mt-3" disabled={!canManage} onClick={() => setShowAccessSetup(true)}>
            <ShieldCheck size={16} /> {t("integrations.setupAction.enterAccessKey")}
          </Button>
        </div>
      ) : (
        <Input
          label={t("integrations.moysklad.accessKey")}
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          placeholder={tokenConfigured ? t("integrations.setupAction.accessKeyReplacePlaceholder") : t("integrations.moysklad.accessKeyPlaceholder")}
          type="password"
          autoComplete="off"
        />
      )}

      <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? t("integrations.setupAction.hideAdvanced") : t("integrations.setupAction.showAdvanced")}
      </button>
      {showAdvanced ? (
        <div className="space-y-3 rounded-2xl bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["products", t("integrations.moysklad.entity.products")],
              ["stock", t("integrations.moysklad.entity.stock")],
              ["sales", t("integrations.moysklad.entity.sales")],
              ["clients", t("integrations.moysklad.entity.clients")],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={entities.includes(value)} onChange={() => toggleEntity(value)} />
                {label}
              </label>
            ))}
          </div>
          <Input label={t("integrations.moysklad.pageSize")} value={pageSize} onChange={(event) => setPageSize(event.target.value)} placeholder="50" type="number" />
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Button type="button" disabled={!canManage || (!accessToken.trim() && !connector)} isLoading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
          <ShieldCheck size={16} /> {connector ? t("integrations.setupAction.saveAccess") : t("integrations.moysklad.connect")}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <RefreshCw size={16} /> {t("integrations.card.check")}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured || !entities.length} isLoading={syncData.isPending} onClick={() => syncData.mutate()}>
          <DatabaseZap size={16} /> {t("integrations.moysklad.loadData")}
        </Button>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        {t("integrations.moysklad.readOnlyNotice")}
      </p>
    </div>
  );
}
