import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock3, Plus, Scissors, WalletCards } from "lucide-react";
import { useState } from "react";

import { getApiErrorMessage } from "../../api/client";
import { servicesApi } from "../../api/services";
import { ServiceForm } from "../../components/forms/ServiceForm";
import { DataTable } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { Service } from "../../types";

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint: string; icon: typeof Scissors }) {
  return (
    <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-midnight">{value}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon size={22} />
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{hint}</p>
    </div>
  );
}

export function ServicesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { services, appointments } = useEntityData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | undefined>();
  const mutation = useMutation({
    mutationFn: (payload: Partial<Service>) =>
      editing ? servicesApi.update({ id: editing.id, payload }) : servicesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setOpen(false);
      setEditing(undefined);
    },
  });

  if (!business) return <ErrorState message={t("services.noBusiness")} />;
  if (services.isLoading || appointments.isLoading) return <LoadingState />;

  const serviceList = services.data || [];
  const activeServices = serviceList.filter((service) => service.is_active);
  const avgDuration = activeServices.length ? Math.round(activeServices.reduce((sum, service) => sum + service.duration_minutes, 0) / activeServices.length) : 0;
  const usedServiceIds = new Set((appointments.data || []).map((appointment) => appointment.service));
  const serviceUsage = (service: Service) => (appointments.data || []).filter((appointment) => appointment.service === service.id).length;

  return (
    <>
      <PageHeader title={t("services.title")} description={t("services.description")} actions={<Button onClick={() => setOpen(true)}><Plus size={18} />{t("services.add")}</Button>} />
      <section className="mb-5 grid gap-3 lg:grid-cols-3">
        <StatCard label={t("services.active")} value={activeServices.length} hint={t("services.activeHint")} icon={Scissors} />
        <StatCard label={t("services.avgDuration")} value={avgDuration ? `${avgDuration} ${t("appointment.minutes")}` : "-"} hint={t("services.avgDurationHint")} icon={Clock3} />
        <StatCard label={t("services.usedInBookings")} value={usedServiceIds.size} hint={t("services.usedInBookingsHint")} icon={WalletCards} />
      </section>
      <div className="mb-5 rounded-3xl border border-brand-100 bg-white/80 p-4 text-sm leading-6 text-slate-600 shadow-sm">
        <span className="font-black text-midnight">{t("services.logicTitle")}</span> {t("services.logicText")}
      </div>
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}
      <DataTable
        rows={serviceList}
        emptyTitle={t("services.emptyTitle")}
        emptyDescription={t("services.emptyText")}
        emptyAction={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />{t("services.add")}</Button>}
        columns={[
          { header: t("services.name"), cell: (service) => <span className="font-medium text-ink">{service.name}</span> },
          { header: t("services.duration"), cell: (service) => `${service.duration_minutes} ${t("appointment.minutes")}` },
          { header: t("services.priceFrom"), cell: (service) => service.price_from || "-" },
          { header: t("services.bookings"), cell: (service) => serviceUsage(service) },
          { header: t("appointment.status"), cell: (service) => <StatusBadge status={service.is_active ? "active" : "inactive"} /> },
          { header: t("appointments.actions"), cell: (service) => <Button variant="ghost" onClick={() => { setEditing(service); setOpen(true); }}>{t("appointments.edit")}</Button> },
        ]}
      />
      <Modal title={editing ? t("services.editTitle") : t("services.add")} open={open} onClose={() => { setOpen(false); setEditing(undefined); }}>
        <ServiceForm businessId={business.id} initial={editing} onSubmit={(payload) => mutation.mutateAsync(payload)} />
      </Modal>
    </>
  );
}
