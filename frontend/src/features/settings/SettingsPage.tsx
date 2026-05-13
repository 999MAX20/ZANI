import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { billingApi } from "../../api/billing";
import { businessesApi } from "../../api/businesses";
import { getApiErrorMessage } from "../../api/client";
import { BusinessSettingsForm } from "../../components/forms/BusinessSettingsForm";
import { Card, CardBody } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import type { Business } from "../../types";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { business, isLoading } = useActiveBusiness();
  const subscription = useQuery({
    queryKey: ["current-subscription"],
    queryFn: billingApi.currentSubscription,
  });
  const usage = useQuery({
    queryKey: ["billing-usage-summary"],
    queryFn: billingApi.usageSummary,
  });
  const mutation = useMutation({
    mutationFn: (payload: Partial<Business>) =>
      business ? businessesApi.update({ id: business.id, payload }) : businessesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["businesses"] }),
  });

  if (isLoading) return <LoadingState />;

  const currentPlan = subscription.data?.plan;
  const hasSubscription = Boolean(subscription.data && currentPlan);

  return (
    <>
      <PageHeader title="Настройки" description="Основные данные бизнеса и контакты для интеграций." />
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}
      <Card className="mb-5">
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Текущий тариф</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">
                {subscription.isLoading ? "Загрузка..." : currentPlan?.name || "Тариф не назначен"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {hasSubscription
                  ? `${formatPrice(currentPlan?.monthly_price)} · статус: ${subscription.data?.status}`
                  : "Billing foundation подключен, но подписка для бизнеса пока не создана."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              Оплата не подключена
            </div>
          </div>
        </CardBody>
      </Card>
      <Card className="mb-5">
        <CardBody>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Usage</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">Лимиты и использование</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Счётчики уже пишутся, но операции пока не блокируются жёстко без UX.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {(usage.data || []).map((item) => {
              const percent = item.limit ? Math.min(100, Math.round((item.value / item.limit) * 100)) : 0;
              return (
                <div key={item.metric} className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{formatMetric(item.metric)}</p>
                  <p className="mt-2 text-2xl font-black text-midnight">
                    {item.value}
                    <span className="text-sm font-semibold text-slate-400"> / {item.limit ?? "∞"}</span>
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-ai-gradient" style={{ width: `${item.limit ? percent : 8}%` }} />
                  </div>
                  {item.is_over_limit ? <p className="mt-2 text-xs font-semibold text-red-600">Лимит достигнут</p> : null}
                </div>
              );
            })}
            {!usage.isLoading && !usage.data?.length ? (
              <p className="text-sm text-slate-500">Usage counters появятся после AI-запросов, bot messages и conversations.</p>
            ) : null}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <BusinessSettingsForm initial={business} onSubmit={(payload) => mutation.mutateAsync(payload)} />
        </CardBody>
      </Card>
    </>
  );
}

function formatMetric(metric: string) {
  const labels: Record<string, string> = {
    ai_requests: "AI requests",
    bot_messages: "Bot messages",
    users: "Users",
    conversations: "Conversations",
  };
  return labels[metric] || metric;
}

function formatPrice(value?: string) {
  if (!value) return "Цена не указана";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return "0 ₸/мес";
  return `${numeric.toLocaleString("ru-RU")} ₸/мес`;
}
