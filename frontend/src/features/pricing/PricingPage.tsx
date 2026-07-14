import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, PauseCircle, PlayCircle, ShieldCheck, SlidersHorizontal, TrendingDown } from "lucide-react";

import { kaspiPricingApi, type KaspiCompetitorOffer, type KaspiPriceChangeLog, type KaspiPricingRecommendation, type KaspiPricingRule, type PricingCatalogItem } from "../../api/pricing";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Select } from "../../components/ui/Select";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../../lib/permissions";
import { useI18n } from "../../lib/i18n";

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "0 ₸";
  return `${Number(value).toLocaleString("ru-KZ")} ₸`;
}

function changeStatusClass(status: KaspiPriceChangeLog["status"]) {
  const classes: Record<KaspiPriceChangeLog["status"], string> = {
    simulated: "bg-blue-50 text-blue-700",
    queued: "bg-violet-50 text-violet-700",
    applied: "bg-emerald-50 text-emerald-700",
    blocked: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
  };
  return classes[status] || "bg-slate-100 text-slate-700";
}

export function PricingPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const canManage = hasPermission(user, business?.id, "integrations", "manage");
  const [form, setForm] = useState({
    product_sku: "",
    product_name: "",
    current_price: "",
    min_price: "",
    step_amount: "1",
    mode: "approval" as KaspiPricingRule["mode"],
    max_changes_per_day: "3",
  });
  const [competitorPrices, setCompetitorPrices] = useState<Record<string, string>>({});
  const [catalogMinPrices, setCatalogMinPrices] = useState<Record<string, string>>({});
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Array<string>>([]);
  const [bulkMinPrice, setBulkMinPrice] = useState("");
  const [bulkStepAmount, setBulkStepAmount] = useState("1");
  const [bulkMaxChanges, setBulkMaxChanges] = useState("3");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSource, setCatalogSource] = useState("");
  const [catalogRuleState, setCatalogRuleState] = useState("");
  const [selectedRuleIds, setSelectedRuleIds] = useState<Array<string>>([]);
  const [bulkRuleStatus, setBulkRuleStatus] = useState("");
  const [bulkRuleMinPrice, setBulkRuleMinPrice] = useState("");
  const [bulkRuleStepAmount, setBulkRuleStepAmount] = useState("");
  const [bulkRuleMaxChanges, setBulkRuleMaxChanges] = useState("");
  const [bulkRuleDisableAutopilot, setBulkRuleDisableAutopilot] = useState(false);
  const [changeSearch, setChangeSearch] = useState("");
  const [changeStatus, setChangeStatus] = useState("");

  const rulesQuery = useQuery({
    queryKey: ["kaspi-pricing-rules", business?.id],
    queryFn: () => kaspiPricingApi.rules.list({ business: business?.id }),
    enabled: Boolean(business?.id),
  });
  const recommendationsQuery = useQuery({
    queryKey: ["kaspi-pricing-recommendations", business?.id],
    queryFn: () => kaspiPricingApi.recommendations.list({ business: business?.id }),
    enabled: Boolean(business?.id),
  });
  const competitorOffersQuery = useQuery({
    queryKey: ["kaspi-competitor-offers", business?.id],
    queryFn: () => kaspiPricingApi.competitorOffers.list({ business: business?.id }),
    enabled: Boolean(business?.id),
  });
  const catalogQuery = useQuery({
    queryKey: ["kaspi-pricing-catalog", business?.id, catalogSearch, catalogSource, catalogRuleState],
    queryFn: () =>
      kaspiPricingApi.catalog.list({
        business: business?.id,
        search: catalogSearch || undefined,
        source: catalogSource || undefined,
        rule_state: catalogRuleState || undefined,
      }),
    enabled: Boolean(business?.id),
  });
  const controlQuery = useQuery({
    queryKey: ["kaspi-pricing-control", business?.id],
    queryFn: () => {
      if (!business?.id) throw new Error("Business is required.");
      return kaspiPricingApi.control.current(business.id);
    },
    enabled: Boolean(business?.id),
  });
  const alertsQuery = useQuery({
    queryKey: ["kaspi-pricing-alerts", business?.id],
    queryFn: () => kaspiPricingApi.alerts.list({ business: business?.id, status: "open" }),
    enabled: Boolean(business?.id),
  });
  const changeLogsQuery = useQuery({
    queryKey: ["kaspi-price-change-logs", business?.id, changeSearch, changeStatus],
    queryFn: () =>
      kaspiPricingApi.changeLogs.list({
        business: business?.id,
        search: changeSearch || undefined,
        status: changeStatus || undefined,
      }),
    enabled: Boolean(business?.id),
  });

  const createRule = useMutation({
    mutationFn: () => {
      if (!business?.id) throw new Error("Business is required.");
      return kaspiPricingApi.rules.create({
        business: business.id,
        product_sku: form.product_sku,
        product_name: form.product_name,
        current_price: form.current_price,
        min_price: form.min_price,
        step_amount: form.step_amount,
        mode: form.mode,
        max_changes_per_day: Number(form.max_changes_per_day || 3),
      });
    },
    onSuccess: () => {
      setForm({ product_sku: "", product_name: "", current_price: "", min_price: "", step_amount: "1", mode: "approval", max_changes_per_day: "3" });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-rules"] });
    },
  });
  const syncCatalog = useMutation({
    mutationFn: () => {
      if (!business?.id) throw new Error("Business is required.");
      return kaspiPricingApi.catalog.sync({ business: business.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-catalog"] });
    },
  });
  const createRuleFromCatalog = useMutation({
    mutationFn: (item: PricingCatalogItem) =>
      kaspiPricingApi.catalog.createRule({
        id: item.id,
        minPrice: catalogMinPrices[String(item.id)] || "",
        currentPrice: item.current_price || undefined,
        stepAmount: form.step_amount || "1",
        mode: "approval",
        maxChangesPerDay: Number(form.max_changes_per_day || 3),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-rules"] });
    },
  });
  const bulkCreateRules = useMutation({
    mutationFn: () =>
      kaspiPricingApi.catalog.bulkCreateRules({
        itemIds: selectedCatalogIds.map((id) => Number(id)),
        minPrice: bulkMinPrice,
        stepAmount: bulkStepAmount || "1",
        mode: "approval",
        maxChangesPerDay: Number(bulkMaxChanges || 3),
      }),
    onSuccess: () => {
      setSelectedCatalogIds([]);
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-rules"] });
    },
  });

  const recommend = useMutation({
    mutationFn: (rule: KaspiPricingRule) => {
      const manualPrice = competitorPrices[String(rule.id)] || "";
      return kaspiPricingApi.rules.recommend({
        id: rule.id,
        competitorPrice: manualPrice || undefined,
        competitorName: manualPrice ? "Competitor" : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-rules"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-competitor-offers"] });
    },
  });

  const collectOffers = useMutation({
    mutationFn: (rule: KaspiPricingRule) => kaspiPricingApi.rules.collectOffers({ id: rule.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-rules"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-competitor-offers"] });
    },
  });

  const apply = useMutation({
    mutationFn: (recommendation: KaspiPricingRecommendation) => kaspiPricingApi.recommendations.apply(recommendation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-rules"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-price-change-logs"] });
    },
  });
  const enableAutopilot = useMutation({
    mutationFn: (rule: KaspiPricingRule) => kaspiPricingApi.rules.enableAutopilot(rule.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-rules"] });
    },
  });
  const disableAutopilot = useMutation({
    mutationFn: (rule: KaspiPricingRule) => kaspiPricingApi.rules.disableAutopilot(rule.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-rules"] });
    },
  });
  const bulkUpdateRules = useMutation({
    mutationFn: () =>
      kaspiPricingApi.rules.bulkUpdate({
        ruleIds: selectedRuleIds.map((id) => Number(id)),
        status: bulkRuleStatus ? (bulkRuleStatus as KaspiPricingRule["status"]) : undefined,
        minPrice: bulkRuleMinPrice || undefined,
        stepAmount: bulkRuleStepAmount || undefined,
        maxChangesPerDay: bulkRuleMaxChanges ? Number(bulkRuleMaxChanges) : undefined,
        disableAutopilot: bulkRuleDisableAutopilot,
      }),
    onSuccess: () => {
      setSelectedRuleIds([]);
      setBulkRuleStatus("");
      setBulkRuleMinPrice("");
      setBulkRuleStepAmount("");
      setBulkRuleMaxChanges("");
      setBulkRuleDisableAutopilot(false);
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-rules"] });
    },
  });
  const emergencyStop = useMutation({
    mutationFn: () => {
      if (!business?.id) throw new Error("Business is required.");
      return kaspiPricingApi.control.emergencyStop({ business: business.id, reason: "Stopped from ZANI workspace." });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-control"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-alerts"] });
    },
  });
  const resumePricing = useMutation({
    mutationFn: () => {
      if (!business?.id) throw new Error("Business is required.");
      return kaspiPricingApi.control.resume(business.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-control"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-alerts"] });
    },
  });

  const rules = rulesQuery.data || [];
  const catalogItems = catalogQuery.data || [];
  const catalogSources = useMemo(() => Array.from(new Set(catalogItems.map((item) => item.source).filter(Boolean))).sort(), [catalogItems]);
  const alerts = alertsQuery.data || [];
  const control = controlQuery.data;
  const changeLogs = changeLogsQuery.data || [];
  const latestRecommendations = useMemo(() => {
    const map = new Map<string, KaspiPricingRecommendation>();
    for (const item of recommendationsQuery.data || []) {
      const key = String(item.rule);
      if (!map.has(key)) map.set(key, item);
    }
    return map;
  }, [recommendationsQuery.data]);
  const latestOffers = useMemo(() => {
    const map = new Map<string, KaspiCompetitorOffer>();
    for (const item of competitorOffersQuery.data || []) {
      const key = String(item.rule);
      const current = map.get(key);
      if (!current || Number(item.price) < Number(current.price)) map.set(key, item);
    }
    return map;
  }, [competitorOffersQuery.data]);
  const error =
    rulesQuery.error ||
    recommendationsQuery.error ||
    competitorOffersQuery.error ||
    catalogQuery.error ||
    controlQuery.error ||
    alertsQuery.error ||
    changeLogsQuery.error ||
    createRule.error ||
    syncCatalog.error ||
    createRuleFromCatalog.error ||
    bulkCreateRules.error ||
    recommend.error ||
    collectOffers.error ||
    apply.error ||
    enableAutopilot.error ||
    disableAutopilot.error ||
    bulkUpdateRules.error ||
    emergencyStop.error ||
    resumePricing.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kaspi Pricing"
        description={t("pricing.description")}
      />

      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}

      <section className={control?.emergency_stop_enabled ? "rounded-[2rem] border border-red-200 bg-red-50 p-5 shadow-soft" : "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className={control?.emergency_stop_enabled ? "mt-1 text-red-600" : "mt-1 text-amber-500"} size={22} />
            <div>
              <h2 className="text-lg font-black text-midnight">{t("pricing.safetyTitle")}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {control?.emergency_stop_enabled
                  ? t("pricing.agentStopped", { reason: control.emergency_stop_reason || t("pricing.noReason") })
                  : t("pricing.agentActive")}
              </p>
              {alerts.length ? <p className="mt-1 text-sm font-bold text-amber-700">{t("pricing.openSignals", { count: alerts.length })}</p> : null}
            </div>
          </div>
          {control?.emergency_stop_enabled ? (
            <Button disabled={!canManage} isLoading={resumePricing.isPending} onClick={() => resumePricing.mutate()}>
              {t("pricing.resume")}
            </Button>
          ) : (
            <Button variant="danger" disabled={!canManage} isLoading={emergencyStop.isPending} onClick={() => emergencyStop.mutate()}>
              {t("pricing.stopAgent")}
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-midnight">{t("pricing.catalogTitle")}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{t("pricing.catalogText")}</p>
          </div>
          <Button variant="secondary" disabled={!canManage || !business?.id} isLoading={syncCatalog.isPending} onClick={() => syncCatalog.mutate()}>
            {t("pricing.refreshCatalog")}
          </Button>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Input label={t("pricing.bulkMinPrice")} value={bulkMinPrice} onChange={(event) => setBulkMinPrice(event.target.value)} type="number" />
            <Input label={t("pricing.step")} value={bulkStepAmount} onChange={(event) => setBulkStepAmount(event.target.value)} type="number" />
            <Input label={t("pricing.dailyLimit")} value={bulkMaxChanges} onChange={(event) => setBulkMaxChanges(event.target.value)} type="number" />
            <Button className="self-end" disabled={!canManage || !selectedCatalogIds.length || !bulkMinPrice} isLoading={bulkCreateRules.isPending} onClick={() => bulkCreateRules.mutate()}>
              {t("pricing.createForSelected", { count: selectedCatalogIds.length })}
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input label={t("common.search")} value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder={t("pricing.searchPlaceholder")} />
          <Select
            label={t("pricing.source")}
            value={catalogSource}
            onChange={(event) => setCatalogSource(event.target.value)}
            options={[{ value: "", label: t("pricing.allSources") }, ...catalogSources.map((source) => ({ value: source, label: source }))]}
          />
          <Select
            label={t("pricing.status")}
            value={catalogRuleState}
            onChange={(event) => setCatalogRuleState(event.target.value)}
            options={[
              { value: "", label: t("pricing.allProducts") },
              { value: "missing", label: t("pricing.withoutRule") },
              { value: "connected", label: t("pricing.connectedProducts") },
            ]}
          />
        </div>
        {catalogQuery.isLoading ? <LoadingState label={t("pricing.loadingCatalog")} /> : null}
        <div className="mt-4 grid gap-3">
          {catalogItems.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    className="mt-1 h-5 w-5 rounded border-slate-300"
                    type="checkbox"
                    checked={selectedCatalogIds.includes(String(item.id))}
                    disabled={Boolean(item.rule_id)}
                    onChange={(event) => {
                      const id = String(item.id);
                      setSelectedCatalogIds(event.target.checked ? [...selectedCatalogIds, id] : selectedCatalogIds.filter((value) => value !== id));
                    }}
                    aria-label={t("pricing.selectItem", { name: item.name || item.sku })}
                  />
                  <div>
                  <p className="text-base font-black text-midnight">{item.name || item.sku}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {t("pricing.catalogItemMeta", {
                      source: item.source,
                      sku: item.sku,
                      price: formatMoney(item.current_price),
                      stock: item.stock_quantity || t("pricing.noData"),
                    })}
                  </p>
                  </div>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                  {item.rule_id ? t("pricing.ruleMode", { mode: item.rule_mode || "" }) : t("pricing.notConnected")}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  label={t("pricing.minPrice")}
                  value={catalogMinPrices[String(item.id)] || ""}
                  onChange={(event) => setCatalogMinPrices({ ...catalogMinPrices, [String(item.id)]: event.target.value })}
                  type="number"
                  disabled={Boolean(item.rule_id)}
                />
                <Button
                  className="self-end"
                  disabled={!canManage || Boolean(item.rule_id) || !catalogMinPrices[String(item.id)]}
                  isLoading={createRuleFromCatalog.isPending}
                  onClick={() => createRuleFromCatalog.mutate(item)}
                >
                  {t("pricing.createRule")}
                </Button>
              </div>
            </article>
          ))}
        </div>
        {!catalogQuery.isLoading && catalogItems.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">{t("pricing.emptyCatalog")}</div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-brand-700" size={20} />
          <h2 className="text-lg font-black text-midnight">{t("pricing.newRule")}</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input label="SKU" value={form.product_sku} onChange={(event) => setForm({ ...form, product_sku: event.target.value })} />
          <Input label={t("pricing.name")} value={form.product_name} onChange={(event) => setForm({ ...form, product_name: event.target.value })} />
          <Input label={t("pricing.currentPrice")} value={form.current_price} onChange={(event) => setForm({ ...form, current_price: event.target.value })} type="number" />
          <Input label={t("pricing.minPrice")} value={form.min_price} onChange={(event) => setForm({ ...form, min_price: event.target.value })} type="number" />
          <Input label={t("pricing.stepBelowCompetitor")} value={form.step_amount} onChange={(event) => setForm({ ...form, step_amount: event.target.value })} type="number" />
          <Input label={t("pricing.dailyChangeLimit")} value={form.max_changes_per_day} onChange={(event) => setForm({ ...form, max_changes_per_day: event.target.value })} type="number" />
          <Select
            value={form.mode}
            onChange={(event) => setForm({ ...form, mode: event.target.value as KaspiPricingRule["mode"] })}
            options={[
              { value: "recommend", label: t("pricing.mode.recommend") },
              { value: "approval", label: t("pricing.mode.approval") },
            ]}
          />
        </div>
        <Button className="mt-4" disabled={!canManage || !form.product_sku || !form.current_price || !form.min_price} isLoading={createRule.isPending} onClick={() => createRule.mutate()}>
          <SlidersHorizontal size={16} /> {t("pricing.createRule")}
        </Button>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-black text-midnight">{t("pricing.rules")}</h2>
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <Select
              label={t("pricing.status")}
              value={bulkRuleStatus}
              onChange={(event) => setBulkRuleStatus(event.target.value)}
              options={[
                { value: "", label: t("pricing.doNotChange") },
                { value: "active", label: t("status.active") },
                { value: "paused", label: t("status.paused") },
                { value: "archived", label: t("status.archived") },
              ]}
            />
            <Input label={t("pricing.newMinPrice")} value={bulkRuleMinPrice} onChange={(event) => setBulkRuleMinPrice(event.target.value)} type="number" />
            <Input label={t("pricing.newStep")} value={bulkRuleStepAmount} onChange={(event) => setBulkRuleStepAmount(event.target.value)} type="number" />
            <Input label={t("pricing.newLimit")} value={bulkRuleMaxChanges} onChange={(event) => setBulkRuleMaxChanges(event.target.value)} type="number" />
            <Button
              className="self-end"
              variant="secondary"
              disabled={
                !canManage ||
                !selectedRuleIds.length ||
                (!bulkRuleStatus && !bulkRuleMinPrice && !bulkRuleStepAmount && !bulkRuleMaxChanges && !bulkRuleDisableAutopilot)
              }
              isLoading={bulkUpdateRules.isPending}
              onClick={() => bulkUpdateRules.mutate()}
            >
              {t("pricing.updateSelected", { count: selectedRuleIds.length })}
            </Button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600">
            <input className="h-4 w-4 rounded border-slate-300" type="checkbox" checked={bulkRuleDisableAutopilot} onChange={(event) => setBulkRuleDisableAutopilot(event.target.checked)} />
            {t("pricing.disableAutopilotSelected")}
          </label>
        </div>
        {rulesQuery.isLoading ? <LoadingState label={t("pricing.loadingRules")} /> : null}
        <div className="mt-4 grid gap-3">
          {rules.map((rule) => {
            const latest = latestRecommendations.get(String(rule.id));
            const latestOffer = latestOffers.get(String(rule.id));
            return (
              <article key={rule.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      className="mt-1 h-5 w-5 rounded border-slate-300"
                      type="checkbox"
                      checked={selectedRuleIds.includes(String(rule.id))}
                      onChange={(event) => {
                        const id = String(rule.id);
                        setSelectedRuleIds(event.target.checked ? [...selectedRuleIds, id] : selectedRuleIds.filter((value) => value !== id));
                      }}
                      aria-label={t("pricing.selectRule", { name: rule.product_name || rule.product_sku })}
                    />
                    <div>
                      <p className="text-base font-black text-midnight">{rule.product_name || rule.product_sku}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {t("pricing.ruleMeta", { sku: rule.product_sku, current: formatMoney(rule.current_price), min: formatMoney(rule.min_price) })}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{rule.mode} · {rule.status}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                  <Input
                    label={t("pricing.manualCompetitorPrice")}
                    value={competitorPrices[String(rule.id)] || ""}
                    onChange={(event) => setCompetitorPrices({ ...competitorPrices, [String(rule.id)]: event.target.value })}
                    type="number"
                  />
                  <Button className="self-end" variant="secondary" disabled={!canManage} isLoading={collectOffers.isPending} onClick={() => collectOffers.mutate(rule)}>
                    {t("pricing.collectPrices")}
                  </Button>
                  <Button className="self-end" variant="secondary" disabled={!canManage} isLoading={recommend.isPending} onClick={() => recommend.mutate(rule)}>
                    <TrendingDown size={16} /> {t("pricing.calculate")}
                  </Button>
                  <Button className="self-end" disabled={!canManage || !latest || latest.status !== "proposed"} isLoading={apply.isPending} onClick={() => latest && apply.mutate(latest)}>
                    {t("pricing.apply")}
                  </Button>
                </div>
                {latestOffer ? (
                  <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                    {t("pricing.foundPrice", {
                      price: formatMoney(latestOffer.price),
                      competitor: latestOffer.competitor_name || t("pricing.competitor"),
                      position: latestOffer.position || 1,
                    })}
                  </div>
                ) : null}
                {latest ? (
                  <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                    {t("pricing.recommendationLine", { price: formatMoney(latest.target_price), reason: latest.reason, status: latest.status })}
                  </div>
                ) : null}
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-midnight">{t("pricing.autopilot")}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {rule.mode === "autopilot"
                          ? t("pricing.autopilotEnabledText")
                          : t("pricing.autopilotCheckText")}
                      </p>
                    </div>
                    {rule.mode === "autopilot" ? (
                      <Button variant="secondary" disabled={!canManage} isLoading={disableAutopilot.isPending} onClick={() => disableAutopilot.mutate(rule)}>
                        <PauseCircle size={16} /> {t("pricing.stop")}
                      </Button>
                    ) : (
                      <Button disabled={!canManage || !latestOffer || Number(rule.min_price) <= 0 || rule.max_changes_per_day <= 0} isLoading={enableAutopilot.isPending} onClick={() => enableAutopilot.mutate(rule)}>
                        <PlayCircle size={16} /> {t("pricing.enableAutopilot")}
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600 md:grid-cols-4">
                    <span className="rounded-xl bg-slate-50 px-3 py-2">{t("pricing.minPriceValue", { price: formatMoney(rule.min_price) })}</span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2">{t("pricing.limitValue", { count: rule.max_changes_per_day })}</span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2">{t("pricing.monitoringValue", { status: latestOffer ? t("pricing.priceFound") : t("pricing.collectPricesFirst") })}</span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2">{t("pricing.kaspiWriteFlag")}</span>
                  </div>
                  {rule.autopilot_confirmed_at ? (
                    <p className="mt-2 text-xs font-bold text-emerald-700">{t("pricing.confirmedAt", { date: new Date(rule.autopilot_confirmed_at).toLocaleString("ru-KZ") })}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-midnight">{t("pricing.historyTitle")}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{t("pricing.historyText")}</p>
          </div>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-500">{t("pricing.recordsCount", { count: changeLogs.length })}</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input label={t("common.search")} value={changeSearch} onChange={(event) => setChangeSearch(event.target.value)} placeholder={t("pricing.historySearchPlaceholder")} />
          <Select
            label={t("pricing.status")}
            value={changeStatus}
            onChange={(event) => setChangeStatus(event.target.value)}
            options={[
              { value: "", label: t("pricing.allStatuses") },
              { value: "simulated", label: t("pricing.changeStatus.simulated") },
              { value: "queued", label: t("pricing.changeStatus.queued") },
              { value: "applied", label: t("pricing.changeStatus.applied") },
              { value: "blocked", label: t("pricing.changeStatus.blocked") },
              { value: "failed", label: t("pricing.changeStatus.failed") },
            ]}
          />
        </div>
        {changeLogsQuery.isLoading ? <LoadingState label={t("pricing.loadingHistory")} /> : null}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
          {changeLogs.map((log) => (
            <article key={log.id} className="grid gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 last:border-b-0 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-black text-midnight">{log.product_name || log.product_sku}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">SKU {log.product_sku} · {new Date(log.created_at).toLocaleString("ru-KZ")}</p>
              </div>
              <div className="text-sm font-black text-midnight">
                {formatMoney(log.old_price)} → {formatMoney(log.new_price)}
                {log.error ? <p className="mt-1 text-xs font-semibold text-red-600">{log.error}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <span className={`rounded-full px-3 py-1 text-xs font-black ${changeStatusClass(log.status)}`}>{t(`pricing.changeStatus.${log.status}`)}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500">{log.mode || "approval"}</span>
              </div>
            </article>
          ))}
          {!changeLogsQuery.isLoading && changeLogs.length === 0 ? (
            <div className="bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">{t("pricing.emptyHistory")}</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
