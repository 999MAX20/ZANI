import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, CreditCard, Headphones, Search, Store, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { platformApi } from "../../api/platform";
import { Card, CardBody } from "../../components/ui/Card";
import { ErrorState, LoadingState, EmptyState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import type { PlatformMerchant } from "../../types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatMoney(value?: string) {
  return new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function statusClass(status?: string | null) {
  if (status === "active" || status === "healthy") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "trial" || status === "setup") return "bg-violet-50 text-violet-700 border-violet-100";
  if (status === "attention") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "blocked" || status === "cancelled" || status === "overdue" || status === "risk") return "bg-red-50 text-red-700 border-red-100";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function usageText(merchant: PlatformMerchant) {
  const ai = merchant.usage_summary.find((item) => item.metric === "ai_requests");
  const messages = merchant.usage_summary.find((item) => item.metric === "bot_messages");
  return `AI ${ai?.value ?? 0}${ai?.limit ? `/${ai.limit}` : ""} · Bot messages ${messages?.value ?? 0}${messages?.limit ? `/${messages.limit}` : ""}`;
}

export function PlatformMerchantsPage() {
  const [query, setQuery] = useState("");
  const merchants = useQuery({ queryKey: ["platform-merchants"], queryFn: platformApi.merchants });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return merchants.data || [];
    return (merchants.data || []).filter((merchant) =>
      [merchant.name, merchant.owner.email, merchant.owner.full_name || "", merchant.status, merchant.plan?.name || ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [merchants.data, query]);

  if (merchants.isLoading) return <LoadingState label="Загружаем merchants..." />;
  if (merchants.isError) return <ErrorState message="Не удалось загрузить список merchants." />;

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Merchant operations</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-midnight sm:text-5xl">Merchants</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Обзор бизнесов, владельцев, подписок и usage без доступа к внутренним данным мерчанта.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-sm">
            <Search size={18} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search merchants..."
              className="w-full min-w-[220px] bg-transparent text-sm font-semibold text-midnight outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </section>

      {!filtered.length ? (
        <EmptyState title="Merchants не найдены" description="Попробуйте изменить поисковый запрос." />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-5 py-4">Merchant</th>
                  <th className="px-5 py-4">Owner</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Plan</th>
                  <th className="px-5 py-4">Pilot health</th>
                  <th className="px-5 py-4">Operations</th>
                  <th className="px-5 py-4">Support workflow</th>
                  <th className="px-5 py-4">Usage</th>
                  <th className="px-5 py-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((merchant) => (
                  <tr key={merchant.id} className="border-b border-slate-100/80 last:border-0">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                          <Store size={20} />
                        </div>
                        <div>
                          <Link to={`/platform/merchants/${merchant.id}`} className="font-bold text-midnight hover:text-brand-700">
                            {merchant.name}
                          </Link>
                          <p className="mt-1 text-xs font-semibold text-slate-400">ID {merchant.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <UserRound size={17} className="text-slate-400" />
                        <div>
                          <p className="font-semibold text-midnight">{merchant.owner.full_name || "No name"}</p>
                          <p className="text-xs text-slate-500">{merchant.owner.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2">
                        <span className={cn("inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold", statusClass(merchant.status))}>
                          {merchant.status}
                        </span>
                        <span className={cn("inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold", statusClass(merchant.subscription_status))}>
                          {merchant.subscription_status || "no subscription"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <CreditCard size={17} className="text-slate-400" />
                        <div>
                          <p className="font-semibold text-midnight">{merchant.plan?.name || "No plan"}</p>
                          <p className="text-xs text-slate-500">{merchant.plan ? `${formatMoney(merchant.plan.monthly_price)} ₸ / mo` : "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="min-w-[220px]">
                        <div className="flex items-center gap-2">
                          {merchant.health?.status === "healthy" ? (
                            <CheckCircle2 size={17} className="text-emerald-500" />
                          ) : (
                            <AlertTriangle size={17} className="text-amber-500" />
                          )}
                          <span className={cn("inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold", statusClass(merchant.health?.status))}>
                            {merchant.health?.status || "unknown"} · {merchant.health?.score ?? 0}%
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-500">{merchant.health?.next_action || "Проверить пилот"}</p>
                        {!!merchant.health?.blockers?.length && (
                          <p className="mt-1 line-clamp-2 text-xs text-amber-700">{merchant.health.blockers.join(" · ")}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="min-w-[180px] text-xs font-semibold leading-6 text-slate-600">
                        <p>Лиды: {merchant.operations?.lead_count ?? 0} · новые: {merchant.operations?.new_leads ?? 0}</p>
                        <p>Inbox: {merchant.operations?.unread_conversations ?? 0} unread · {merchant.operations?.handoff_conversations ?? 0} handoff</p>
                        <p>Источники: {merchant.operations?.connected_connectors ?? 0} ok · {merchant.operations?.failed_connectors ?? 0} fail</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="min-w-[240px] rounded-3xl border border-slate-100 bg-slate-50/80 p-3">
                        <div className="flex items-center gap-2">
                          <Headphones size={16} className={merchant.support_workflow?.priority === "high" ? "text-red-500" : merchant.support_workflow?.priority === "medium" ? "text-amber-500" : "text-emerald-500"} />
                          <span className={cn("inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-bold", statusClass(merchant.support_workflow?.priority === "high" ? "risk" : merchant.support_workflow?.priority === "medium" ? "attention" : "healthy"))}>
                            support {merchant.support_workflow?.priority || "low"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{merchant.support_workflow?.summary || merchant.health?.next_action || "Мониторить пилот"}</p>
                        {!!merchant.support_workflow?.next_steps?.length && (
                          <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-brand-700">
                            {merchant.support_workflow.next_steps.map((step) => step.label).join(" · ")}
                          </p>
                        )}
                        <Link
                          to={`/platform/merchants/${merchant.id}`}
                          className="mt-3 inline-flex text-xs font-black text-brand-700 hover:text-brand-900"
                        >
                          Открыть support view
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Activity size={17} className="text-slate-400" />
                        <span className="font-semibold">{usageText(merchant)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-500">
                      <p>{merchant.created_at ? formatDate(merchant.created_at) : "—"}</p>
                      {merchant.latest_activity_at && <p className="mt-1 text-xs text-slate-400">last {formatDate(merchant.latest_activity_at)}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
