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
      <Card>
        <CardBody>
          <BusinessSettingsForm initial={business} onSubmit={(payload) => mutation.mutateAsync(payload)} />
        </CardBody>
      </Card>
    </>
  );
}

function formatPrice(value?: string) {
  if (!value) return "Цена не указана";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return "0 ₸/мес";
  return `${numeric.toLocaleString("ru-RU")} ₸/мес`;
}
