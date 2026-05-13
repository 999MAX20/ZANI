import { useQuery } from "@tanstack/react-query";
import { Activity, CreditCard, Search, Store, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

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
  if (status === "active") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "trial") return "bg-violet-50 text-violet-700 border-violet-100";
  if (status === "blocked" || status === "cancelled" || status === "overdue") return "bg-red-50 text-red-700 border-red-100";
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
                          <p className="font-bold text-midnight">{merchant.name}</p>
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
                      <div className="flex items-center gap-2 text-slate-600">
                        <Activity size={17} className="text-slate-400" />
                        <span className="font-semibold">{usageText(merchant)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-500">{formatDate(merchant.created_at)}</td>
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
