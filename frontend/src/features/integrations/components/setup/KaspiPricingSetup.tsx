import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";

import { kaspiPricingApi, type KaspiPriceChangeLog, type KaspiPricingRule } from "../../../../api/pricing";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { cn } from "../../../../lib/cn";
import { useI18n } from "../../../../lib/i18n";
import type { Id } from "../../../../types";

type Translate = ReturnType<typeof useI18n>["t"];

function readableStatus(status: string | undefined, t: Translate, fallback = t("integrations.status.notConnected")) {
  if (!status) return fallback;
  const labels: Record<string, string> = {
    connected: "integrations.status.connected",
    active: "integrations.status.active",
    failed: "integrations.status.failed",
    error: "integrations.status.error",
    draft: "integrations.status.draft",
    paused: "integrations.status.paused",
    skipped: "integrations.status.skipped",
    applied: "integrations.status.applied",
    pending: "integrations.status.pending",
  };
  return labels[status] ? t(labels[status]) : status;
}

export function KaspiPricingInlineSetup({ businessId, canManage }: { businessId: Id; canManage: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const control = useQuery({
    queryKey: ["kaspi-pricing-control", businessId],
    queryFn: () => kaspiPricingApi.control.current(businessId),
  });
  const rules = useQuery({
    queryKey: ["kaspi-pricing-rules", businessId],
    queryFn: () => kaspiPricingApi.rules.list({ business: businessId }),
  });
  const alerts = useQuery({
    queryKey: ["kaspi-pricing-alerts", businessId],
    queryFn: () => kaspiPricingApi.alerts.list({ business: businessId, status: "open" }),
  });
  const changeLogs = useQuery({
    queryKey: ["kaspi-price-change-logs", businessId],
    queryFn: () => kaspiPricingApi.changeLogs.list({ business: businessId }),
  });

  const emergencyStop = useMutation({
    mutationFn: () => kaspiPricingApi.control.emergencyStop({ business: businessId, reason: "Stopped from Kaspi Pricing integration setup." }),
    onSuccess: () => {
      setNotice(t("integrations.kaspiPricing.stoppedNotice"));
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-control"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-alerts"] });
    },
  });
  const resumePricing = useMutation({
    mutationFn: () => kaspiPricingApi.control.resume(businessId),
    onSuccess: () => {
      setNotice(t("integrations.kaspiPricing.resumedNotice"));
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-control"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-alerts"] });
    },
  });

  const error = control.error || rules.error || alerts.error || changeLogs.error || emergencyStop.error || resumePricing.error;
  const ruleList = rules.data || [];
  const alertList = alerts.data || [];
  const logList = changeLogs.data || [];
  const latestLog = logList[0] as KaspiPriceChangeLog | undefined;
  const autopilotCount = ruleList.filter((rule: KaspiPricingRule) => rule.mode === "autopilot").length;
  const activeCount = ruleList.filter((rule: KaspiPricingRule) => rule.status === "active").length;
  const stopped = Boolean(control.data?.emergency_stop_enabled);

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-amber-950">{t("integrations.kaspiPricing.productTitle")}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
              {t("integrations.kaspiPricing.productDescription")}
            </p>
          </div>
          <Link to="/app/pricing">
            <Button type="button">
              <TrendingDown size={16} /> {t("integrations.kaspiPricing.openAgent")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.kaspiPricing.rules")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{ruleList.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.kaspiPricing.activeRules")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{activeCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.kaspiPricing.autopilot")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{autopilotCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{t("integrations.kaspiPricing.signals")}</p>
          <p className="mt-1 text-sm font-black text-midnight">{alertList.length}</p>
        </div>
      </div>

      <div className={cn("rounded-3xl border p-4", stopped ? "border-red-100 bg-red-50" : "border-emerald-100 bg-emerald-50")}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={cn("text-sm font-black", stopped ? "text-red-950" : "text-emerald-950")}>{stopped ? t("integrations.kaspiPricing.agentStopped") : t("integrations.kaspiPricing.agentReady")}</p>
            <p className={cn("mt-1 text-sm font-semibold leading-6", stopped ? "text-red-800" : "text-emerald-800")}>
              {stopped ? control.data?.emergency_stop_reason || t("integrations.kaspiPricing.priceApplyBlocked") : t("integrations.kaspiPricing.emergencyStopDescription")}
            </p>
          </div>
          {stopped ? (
            <Button type="button" disabled={!canManage} isLoading={resumePricing.isPending} onClick={() => resumePricing.mutate()}>
              {t("integrations.kaspiPricing.resume")}
            </Button>
          ) : (
            <Button type="button" variant="danger" disabled={!canManage} isLoading={emergencyStop.isPending} onClick={() => emergencyStop.mutate()}>
              {t("integrations.kaspiPricing.stopAgent")}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-midnight">{t("integrations.kaspiPricing.latestChange")}</p>
          <Link to="/app/pricing">
            <Button type="button" variant="ghost" size="sm">
              {t("integrations.kaspiPricing.history")}
            </Button>
          </Link>
        </div>
        {latestLog ? (
          <div className="mt-3 rounded-2xl bg-slate-50 p-3">
            <p className="text-sm font-black text-midnight">{latestLog.product_name || latestLog.product_sku}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {Number(latestLog.old_price).toLocaleString("ru-KZ")} ₸ → {Number(latestLog.new_price).toLocaleString("ru-KZ")} ₸ · {readableStatus(latestLog.status, t)}
            </p>
            {latestLog.error ? <p className="mt-1 text-xs font-semibold text-red-600">{latestLog.error}</p> : null}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">{t("integrations.kaspiPricing.noChanges")}</p>
        )}
      </div>
    </div>
  );
}
