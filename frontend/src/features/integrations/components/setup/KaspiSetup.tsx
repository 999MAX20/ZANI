import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap, RefreshCw, ShieldCheck } from "lucide-react";

import { businessConnectorsApi } from "../../../../api/connectors";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { useI18n } from "../../../../lib/i18n";
import type { BusinessConnector, Id } from "../../../../types";

export function KaspiInlineSetup({
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
  const [merchantId, setMerchantId] = useState(String(connector?.config_json?.merchant_id || ""));
  const [orderState, setOrderState] = useState(String(connector?.config_json?.order_state || "ARCHIVE"));
  const [syncDays, setSyncDays] = useState(String(connector?.config_json?.sync_days || "14"));
  const [pageSize, setPageSize] = useState(String(connector?.config_json?.page_size || "20"));
  const [showAccessSetup, setShowAccessSetup] = useState(Boolean(connector?.config_json?.api_token_configured));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["kaspi-status", connector?.id],
    queryFn: () => businessConnectorsApi.kaspiStatus(Number(connector?.id)),
    enabled: Boolean(connector?.id),
  });

  const saveConfig = useMutation({
    mutationFn: () => businessConnectorsApi.configureKaspi({
      business: businessId,
      apiToken,
      merchantId,
      orderState,
      syncDays: Number(syncDays || 14),
      pageSize: Number(pageSize || 20),
    }),
    onSuccess: () => {
      setApiToken("");
      setNotice(t("integrations.kaspi.accessSaved"));
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-status"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => businessConnectorsApi.kaspiTestConnection(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("integrations.kaspi.connectionChecked") : data.reason || t("integrations.kaspi.connectionCheckFailed"));
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-status", connector?.id] });
    },
  });

  const syncOrders = useMutation({
    mutationFn: () => businessConnectorsApi.kaspiSyncOrders(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("integrations.kaspi.ordersLoaded", { count: data.events.length }) : data.reason || t("integrations.kaspi.ordersLoadFailed"));
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-status", connector?.id] });
    },
  });

  const error = saveConfig.error || testConnection.error || syncOrders.error || status.error;
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
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.kaspi.orders")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.last_sync_at ? t("integrations.kaspi.ordersLoadedBefore") : t("integrations.setupMetric.notYet")}</p>
        </div>
      </div>

      {!showAccessSetup ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-black text-blue-950">{t("integrations.kaspi.connectionTitle")}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
            {t("integrations.kaspi.connectionDescription")}
          </p>
          <Button type="button" className="mt-3" disabled={!canManage} onClick={() => setShowAccessSetup(true)}>
            <ShieldCheck size={16} /> {t("integrations.setupAction.enterAccessKey")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            label={t("integrations.kaspi.accessKey")}
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            placeholder={tokenConfigured ? t("integrations.setupAction.accessKeyReplacePlaceholder") : t("integrations.kaspi.accessKeyPlaceholder")}
            type="password"
            autoComplete="off"
          />
        </div>
      )}
      <div className="space-y-3">
        <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowAdvanced((value) => !value)}>
          {showAdvanced ? t("integrations.setupAction.hideAdvanced") : t("integrations.setupAction.showAdvanced")}
        </button>
        {showAdvanced ? (
          <div className="grid gap-3 rounded-2xl bg-white p-3 md:grid-cols-2">
            <Input label={t("integrations.kaspi.merchantId")} value={merchantId} onChange={(event) => setMerchantId(event.target.value)} placeholder={t("common.optional")} />
            <Select
              value={orderState}
              onChange={(event) => setOrderState(event.target.value)}
              options={[
                { value: "ARCHIVE", label: t("integrations.kaspi.orderState.archive") },
                { value: "NEW", label: t("integrations.kaspi.orderState.new") },
                { value: "KASPI_DELIVERY", label: "Kaspi Delivery" },
                { value: "PICKUP", label: t("integrations.kaspi.orderState.pickup") },
                { value: "SIGN_REQUIRED", label: t("integrations.kaspi.orderState.signRequired") },
              ]}
            />
            <Input label={t("integrations.setupAction.syncDays")} value={syncDays} onChange={(event) => setSyncDays(event.target.value)} placeholder="14" type="number" />
            <Input label={t("integrations.kaspi.pageSize")} value={pageSize} onChange={(event) => setPageSize(event.target.value)} placeholder="20" type="number" />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Button type="button" disabled={!canManage || (!apiToken.trim() && !merchantId.trim() && !connector)} isLoading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
          <ShieldCheck size={16} /> {connector ? t("integrations.setupAction.saveAccess") : t("integrations.kaspi.connect")}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <RefreshCw size={16} /> {t("integrations.card.check")}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured} isLoading={syncOrders.isPending} onClick={() => syncOrders.mutate()}>
          <DatabaseZap size={16} /> {t("integrations.kaspi.loadOrders")}
        </Button>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        {t("integrations.kaspi.readOnlyNotice")}
      </p>
    </div>
  );
}
