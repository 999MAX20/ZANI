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

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "0 ₸";
  return `${Number(value).toLocaleString("ru-KZ")} ₸`;
}

function readableChangeStatus(status: KaspiPriceChangeLog["status"]) {
  const labels: Record<KaspiPriceChangeLog["status"], string> = {
    simulated: "Симуляция",
    queued: "В очереди",
    applied: "Применено",
    blocked: "Заблокировано",
    failed: "Ошибка",
  };
  return labels[status] || status;
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
        competitorName: manualPrice ? "Конкурент" : undefined,
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
      return kaspiPricingApi.control.emergencyStop({ business: business.id, reason: "Остановлено из кабинета ZANI." });
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
        description="Пороговая цена, рекомендация на 1 ₸ ниже конкурента и безопасное применение через approval."
      />

      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}

      <section className={control?.emergency_stop_enabled ? "rounded-[2rem] border border-red-200 bg-red-50 p-5 shadow-soft" : "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className={control?.emergency_stop_enabled ? "mt-1 text-red-600" : "mt-1 text-amber-500"} size={22} />
            <div>
              <h2 className="text-lg font-black text-midnight">Безопасность ценового агента</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {control?.emergency_stop_enabled ? `Остановлен: ${control.emergency_stop_reason || "без причины"}` : "Агент активен. Emergency stop мгновенно блокирует применение цен."}
              </p>
              {alerts.length ? <p className="mt-1 text-sm font-bold text-amber-700">Открытые сигналы: {alerts.length}</p> : null}
            </div>
          </div>
          {control?.emergency_stop_enabled ? (
            <Button disabled={!canManage} isLoading={resumePricing.isPending} onClick={() => resumePricing.mutate()}>
              Возобновить
            </Button>
          ) : (
            <Button variant="danger" disabled={!canManage} isLoading={emergencyStop.isPending} onClick={() => emergencyStop.mutate()}>
              Остановить агента
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-midnight">Товары из интеграций</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">ZANI собирает товары из Kaspi, МойСклад, 1C, Excel/CSV, Ozon и Wildberries.</p>
          </div>
          <Button variant="secondary" disabled={!canManage || !business?.id} isLoading={syncCatalog.isPending} onClick={() => syncCatalog.mutate()}>
            Обновить товары
          </Button>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Input label="Общий порог" value={bulkMinPrice} onChange={(event) => setBulkMinPrice(event.target.value)} type="number" />
            <Input label="Шаг" value={bulkStepAmount} onChange={(event) => setBulkStepAmount(event.target.value)} type="number" />
            <Input label="Лимит в день" value={bulkMaxChanges} onChange={(event) => setBulkMaxChanges(event.target.value)} type="number" />
            <Button className="self-end" disabled={!canManage || !selectedCatalogIds.length || !bulkMinPrice} isLoading={bulkCreateRules.isPending} onClick={() => bulkCreateRules.mutate()}>
              Создать для выбранных ({selectedCatalogIds.length})
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input label="Поиск" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Название, SKU..." />
          <Select
            label="Источник"
            value={catalogSource}
            onChange={(event) => setCatalogSource(event.target.value)}
            options={[{ value: "", label: "Все источники" }, ...catalogSources.map((source) => ({ value: source, label: source }))]}
          />
          <Select
            label="Статус"
            value={catalogRuleState}
            onChange={(event) => setCatalogRuleState(event.target.value)}
            options={[
              { value: "", label: "Все товары" },
              { value: "missing", label: "Без правила" },
              { value: "connected", label: "Уже подключены" },
            ]}
          />
        </div>
        {catalogQuery.isLoading ? <LoadingState label="Собираем товары" /> : null}
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
                    aria-label={`Выбрать ${item.name || item.sku}`}
                  />
                  <div>
                  <p className="text-base font-black text-midnight">{item.name || item.sku}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {item.source} · SKU {item.sku} · цена {formatMoney(item.current_price)} · остаток {item.stock_quantity || "нет данных"}
                  </p>
                  </div>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{item.rule_id ? `правило: ${item.rule_mode}` : "не подключен"}</span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  label="Не снижать ниже"
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
                  Создать правило
                </Button>
              </div>
            </article>
          ))}
        </div>
        {!catalogQuery.isLoading && catalogItems.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">Подключите или синхронизируйте источник товаров, затем нажмите “Обновить товары”.</div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-brand-700" size={20} />
          <h2 className="text-lg font-black text-midnight">Новое правило</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input label="SKU" value={form.product_sku} onChange={(event) => setForm({ ...form, product_sku: event.target.value })} />
          <Input label="Название" value={form.product_name} onChange={(event) => setForm({ ...form, product_name: event.target.value })} />
          <Input label="Текущая цена" value={form.current_price} onChange={(event) => setForm({ ...form, current_price: event.target.value })} type="number" />
          <Input label="Не снижать ниже" value={form.min_price} onChange={(event) => setForm({ ...form, min_price: event.target.value })} type="number" />
          <Input label="Шаг ниже конкурента" value={form.step_amount} onChange={(event) => setForm({ ...form, step_amount: event.target.value })} type="number" />
          <Input label="Лимит изменений в день" value={form.max_changes_per_day} onChange={(event) => setForm({ ...form, max_changes_per_day: event.target.value })} type="number" />
          <Select
            value={form.mode}
            onChange={(event) => setForm({ ...form, mode: event.target.value as KaspiPricingRule["mode"] })}
            options={[
              { value: "recommend", label: "Только рекомендации" },
              { value: "approval", label: "Подтверждение" },
            ]}
          />
        </div>
        <Button className="mt-4" disabled={!canManage || !form.product_sku || !form.current_price || !form.min_price} isLoading={createRule.isPending} onClick={() => createRule.mutate()}>
          <SlidersHorizontal size={16} /> Создать правило
        </Button>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-black text-midnight">Правила</h2>
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <Select
              label="Статус"
              value={bulkRuleStatus}
              onChange={(event) => setBulkRuleStatus(event.target.value)}
              options={[
                { value: "", label: "Не менять" },
                { value: "active", label: "Активные" },
                { value: "paused", label: "Пауза" },
                { value: "archived", label: "Архив" },
              ]}
            />
            <Input label="Новый порог" value={bulkRuleMinPrice} onChange={(event) => setBulkRuleMinPrice(event.target.value)} type="number" />
            <Input label="Новый шаг" value={bulkRuleStepAmount} onChange={(event) => setBulkRuleStepAmount(event.target.value)} type="number" />
            <Input label="Новый лимит" value={bulkRuleMaxChanges} onChange={(event) => setBulkRuleMaxChanges(event.target.value)} type="number" />
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
              Обновить ({selectedRuleIds.length})
            </Button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600">
            <input className="h-4 w-4 rounded border-slate-300" type="checkbox" checked={bulkRuleDisableAutopilot} onChange={(event) => setBulkRuleDisableAutopilot(event.target.checked)} />
            Выключить автопилот у выбранных
          </label>
        </div>
        {rulesQuery.isLoading ? <LoadingState label="Загружаем правила" /> : null}
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
                      aria-label={`Выбрать ${rule.product_name || rule.product_sku}`}
                    />
                    <div>
                      <p className="text-base font-black text-midnight">{rule.product_name || rule.product_sku}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">SKU {rule.product_sku} · текущая {formatMoney(rule.current_price)} · порог {formatMoney(rule.min_price)}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{rule.mode} · {rule.status}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                  <Input
                    label="Цена конкурента, если нужно вручную"
                    value={competitorPrices[String(rule.id)] || ""}
                    onChange={(event) => setCompetitorPrices({ ...competitorPrices, [String(rule.id)]: event.target.value })}
                    type="number"
                  />
                  <Button className="self-end" variant="secondary" disabled={!canManage} isLoading={collectOffers.isPending} onClick={() => collectOffers.mutate(rule)}>
                    Собрать цены
                  </Button>
                  <Button className="self-end" variant="secondary" disabled={!canManage} isLoading={recommend.isPending} onClick={() => recommend.mutate(rule)}>
                    <TrendingDown size={16} /> Рассчитать
                  </Button>
                  <Button className="self-end" disabled={!canManage || !latest || latest.status !== "proposed"} isLoading={apply.isPending} onClick={() => latest && apply.mutate(latest)}>
                    Применить
                  </Button>
                </div>
                {latestOffer ? (
                  <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                    Найдена цена: {formatMoney(latestOffer.price)} · {latestOffer.competitor_name || "конкурент"} · позиция {latestOffer.position || 1}
                  </div>
                ) : null}
                {latest ? (
                  <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                    Рекомендация: {formatMoney(latest.target_price)} · {latest.reason} · статус {latest.status}
                  </div>
                ) : null}
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-midnight">Автопилот</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {rule.mode === "autopilot"
                          ? "Включен. ZANI может применять безопасные рекомендации в плановом цикле."
                          : "Перед включением ZANI проверяет порог, дневной лимит и наличие мониторинга."}
                      </p>
                    </div>
                    {rule.mode === "autopilot" ? (
                      <Button variant="secondary" disabled={!canManage} isLoading={disableAutopilot.isPending} onClick={() => disableAutopilot.mutate(rule)}>
                        <PauseCircle size={16} /> Остановить
                      </Button>
                    ) : (
                      <Button disabled={!canManage || !latestOffer || Number(rule.min_price) <= 0 || rule.max_changes_per_day <= 0} isLoading={enableAutopilot.isPending} onClick={() => enableAutopilot.mutate(rule)}>
                        <PlayCircle size={16} /> Включить автопилот
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600 md:grid-cols-4">
                    <span className="rounded-xl bg-slate-50 px-3 py-2">Порог: {formatMoney(rule.min_price)}</span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2">Лимит: {rule.max_changes_per_day}/день</span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2">Мониторинг: {latestOffer ? "цена найдена" : "сначала собрать цены"}</span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2">Запись в Kaspi: через флаг</span>
                  </div>
                  {rule.autopilot_confirmed_at ? (
                    <p className="mt-2 text-xs font-bold text-emerald-700">Подтверждено: {new Date(rule.autopilot_confirmed_at).toLocaleString("ru-KZ")}</p>
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
            <h2 className="text-lg font-black text-midnight">История цен</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Все попытки изменения цен: симуляции, очереди, блокировки и ошибки.</p>
          </div>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-500">{changeLogs.length} записей</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input label="Поиск" value={changeSearch} onChange={(event) => setChangeSearch(event.target.value)} placeholder="Название или SKU" />
          <Select
            label="Статус"
            value={changeStatus}
            onChange={(event) => setChangeStatus(event.target.value)}
            options={[
              { value: "", label: "Все статусы" },
              { value: "simulated", label: "Симуляция" },
              { value: "queued", label: "В очереди" },
              { value: "applied", label: "Применено" },
              { value: "blocked", label: "Заблокировано" },
              { value: "failed", label: "Ошибка" },
            ]}
          />
        </div>
        {changeLogsQuery.isLoading ? <LoadingState label="Загружаем историю цен" /> : null}
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
                <span className={`rounded-full px-3 py-1 text-xs font-black ${changeStatusClass(log.status)}`}>{readableChangeStatus(log.status)}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500">{log.mode || "approval"}</span>
              </div>
            </article>
          ))}
          {!changeLogsQuery.isLoading && changeLogs.length === 0 ? (
            <div className="bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">Истории пока нет. Рассчитайте и примените рекомендацию, чтобы увидеть запись.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
