import type { Dispatch, SetStateAction } from "react";

import { getApiErrorMessage } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { ErrorState } from "../../../components/ui/StateViews";
import type { Id, Subscription, SubscriptionPlan } from "../../../types";
import type { Translate } from "../settingsUtils";

type BillingSettingsForm = {
  billing_email: string;
  payment_method: string;
  invoice_name: string;
  invoice_tax_id: string;
  invoice_address: string;
};

type BillingSectionProps = {
  canManageBilling: boolean;
  className: string;
  currentPlan?: SubscriptionPlan | null;
  error: unknown;
  formatPrice: (value: string | undefined, t: Translate, locale: string) => string;
  hasSubscription: boolean;
  isBillingStatusPending: boolean;
  isPlanChangePending: boolean;
  isSavingBillingSettings: boolean;
  locale: string;
  onRequestPlanChange: (plan: Id) => void;
  onSaveBillingSettings: () => void;
  onSubscriptionStatusAction: (action: "pause" | "resume" | "cancel") => void;
  plans: SubscriptionPlan[];
  selectedPlanId: string;
  setBillingSettingsForm: Dispatch<SetStateAction<BillingSettingsForm>>;
  setSelectedPlanId: (planId: string) => void;
  subscription?: Subscription | null;
  subscriptionIsLoading: boolean;
  billingSettingsForm: BillingSettingsForm;
  t: Translate;
};

export function BillingSection({
  billingSettingsForm,
  canManageBilling,
  className,
  currentPlan,
  error,
  formatPrice,
  hasSubscription,
  isBillingStatusPending,
  isPlanChangePending,
  isSavingBillingSettings,
  locale,
  onRequestPlanChange,
  onSaveBillingSettings,
  onSubscriptionStatusAction,
  plans,
  selectedPlanId,
  setBillingSettingsForm,
  setSelectedPlanId,
  subscription,
  subscriptionIsLoading,
  t,
}: BillingSectionProps) {
  return (
    <Card id="billing" className={className}>
      <CardBody>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.currentPlan")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">
              {subscriptionIsLoading ? t("settings.loading") : currentPlan?.name || t("settings.noPlan")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {hasSubscription
                ? `${formatPrice(currentPlan?.monthly_price, t, locale)} В· ${t("settings.status")}: ${subscription?.status}`
                : t("settings.billingNoSubscription")}
            </p>
            {subscription?.requested_plan ? (
              <p className="mt-2 text-sm font-bold text-amber-700">{t("settings.requestedPlan", { id: subscription.requested_plan })}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={!canManageBilling || !subscription || subscription.status === "paused"} onClick={() => onSubscriptionStatusAction("pause")} isLoading={isBillingStatusPending}>
              {t("settings.pauseSubscription")}
            </Button>
            <Button type="button" variant="secondary" disabled={!canManageBilling || !subscription || subscription.status === "active"} onClick={() => onSubscriptionStatusAction("resume")} isLoading={isBillingStatusPending}>
              {t("settings.resumeSubscription")}
            </Button>
            <Button type="button" variant="danger" disabled={!canManageBilling || !subscription || subscription.status === "cancelled"} onClick={() => onSubscriptionStatusAction("cancel")} isLoading={isBillingStatusPending}>
              {t("settings.cancelSubscription")}
            </Button>
          </div>
        </div>
        {error ? (
          <div className="mt-4"><ErrorState message={getApiErrorMessage(error)} /></div>
        ) : null}
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <form
            className="rounded-card border border-slate-200 bg-slate-50 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSaveBillingSettings();
            }}
          >
            <h3 className="font-black text-midnight">{t("settings.billingPaymentsTitle")}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input label={t("settings.billingEmail")} value={billingSettingsForm.billing_email} onChange={(event) => setBillingSettingsForm({ ...billingSettingsForm, billing_email: event.target.value })} />
              <Select
                label={t("settings.paymentMethod")}
                value={billingSettingsForm.payment_method}
                onChange={(event) => setBillingSettingsForm({ ...billingSettingsForm, payment_method: event.target.value })}
                options={[
                  { value: "", label: t("settings.paymentMethod.empty") },
                  { value: "invoice", label: t("settings.paymentMethod.invoice") },
                  { value: "card", label: t("settings.paymentMethod.card") },
                  { value: "bank_transfer", label: t("settings.paymentMethod.bankTransfer") },
                ]}
              />
              <Input label={t("settings.invoiceName")} value={billingSettingsForm.invoice_name} onChange={(event) => setBillingSettingsForm({ ...billingSettingsForm, invoice_name: event.target.value })} />
              <Input label={t("settings.invoiceTaxId")} value={billingSettingsForm.invoice_tax_id} onChange={(event) => setBillingSettingsForm({ ...billingSettingsForm, invoice_tax_id: event.target.value })} />
              <Input className="sm:col-span-2" label={t("settings.invoiceAddress")} value={billingSettingsForm.invoice_address} onChange={(event) => setBillingSettingsForm({ ...billingSettingsForm, invoice_address: event.target.value })} />
            </div>
            <div className="mt-4">
              <Button type="submit" disabled={!canManageBilling || !subscription} isLoading={isSavingBillingSettings}>{t("settings.saveBilling")}</Button>
            </div>
          </form>
          <div className="rounded-card border border-slate-200 bg-white p-4">
            <h3 className="font-black text-midnight">{t("settings.planTitle")}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{t("settings.planChangeText")}</p>
            <div className="mt-4 grid gap-3">
              <Select
                label={t("settings.newPlan")}
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
                options={plans.map((plan) => ({ value: String(plan.id), label: `${plan.name} В· ${formatPrice(plan.monthly_price, t, locale)}` }))}
              />
              <Button type="button" disabled={!canManageBilling || !selectedPlanId || selectedPlanId === String(currentPlan?.id || "")} onClick={() => onRequestPlanChange(Number(selectedPlanId))} isLoading={isPlanChangePending}>
                {t("settings.requestPlanChange")}
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
