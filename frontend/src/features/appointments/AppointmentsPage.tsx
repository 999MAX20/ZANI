import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Clock3, Plus, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { appointmentsApi } from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { DataTable } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { formatDateTime, todayISO } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Appointment } from "../../types";

const quickStatuses: Appointment["status"][] = ["confirmed", "completed", "cancelled", "no_show"];
const statusLabels: Record<Appointment["status"], string> = {
  created: "Запланирована",
  confirmed: "Подтвердить",
  cancelled: "Отменить",
  rescheduled: "Перенесена",
  completed: "Завершить",
  no_show: "Не пришёл",
};

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint: string; icon: typeof CalendarCheck }) {
  return (
    <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-soft backdrop-blur-xl">
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

export function AppointmentsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { appointments, clients, services, resources, leads } = useEntityData();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: Partial<Appointment>) => editing ? appointmentsApi.update({ id: editing.id, payload }) : appointmentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setOpen(false);
      setEditing(undefined);
    },
  });
  const archiveMutation = useMutation({
    mutationFn: appointmentsApi.archive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Appointment["status"] }) => appointmentsApi.update({ id, payload: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const rows = useMemo(() => (appointments.data || []).filter((appointment) => (!date || appointment.start_at.slice(0, 10) === date) && (!status || appointment.status === status)), [appointments.data, date, status]);
  const appointmentList = appointments.data || [];
  const todayRows = appointmentList.filter((appointment) => appointment.start_at.slice(0, 10) === todayISO());
  const confirmedRows = appointmentList.filter((appointment) => appointment.status === "confirmed");
  const completedRows = appointmentList.filter((appointment) => appointment.status === "completed");
  const activeResources = new Set(appointmentList.map((appointment) => appointment.resource).filter(Boolean));

  useEffect(() => {
    const appointmentId = Number(searchParams.get("appointment") || "");
    if (appointmentId) setDrawerEntity({ type: "appointment", id: appointmentId });
  }, [searchParams]);

  if (!business) return <ErrorState message={t("appointments.noBusiness")} />;
  if (appointments.isLoading || clients.isLoading || services.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader title={t("appointments.title")} description={t("appointments.description")} actions={<Button onClick={() => setOpen(true)}><Plus size={18} />{t("appointments.create")}</Button>} />
      <section className="mb-5 grid gap-3 lg:grid-cols-4">
        <StatCard label={t("appointments.today")} value={todayRows.length} hint={t("appointments.todayHint")} icon={CalendarCheck} />
        <StatCard label={t("appointments.confirmed")} value={confirmedRows.length} hint={t("appointments.confirmedHint")} icon={UserRoundCheck} />
        <StatCard label={t("appointments.completed")} value={completedRows.length} hint={t("appointments.completedHint")} icon={CheckCircle2} />
        <StatCard label={t("appointments.resources")} value={activeResources.size} hint={t("appointments.resourcesHint")} icon={Clock3} />
      </section>
      {mutation.error || archiveMutation.error || statusMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error || archiveMutation.error || statusMutation.error)} /></div> : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-[220px_220px]">
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} placeholder={todayISO()} />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: "", label: t("appointments.allStatuses") }, { value: "created", label: t("appointment.statusCreated") }, { value: "confirmed", label: t("appointment.statusConfirmed") }, { value: "cancelled", label: t("appointment.statusCancelled") }, { value: "completed", label: t("appointment.statusCompleted") }, { value: "no_show", label: t("appointment.statusNoShow") }]} />
      </div>
      <DataTable
        rows={rows}
        emptyTitle={t("appointments.emptyTitle")}
        emptyDescription={date || status ? t("appointments.emptyFiltered") : t("appointments.emptyText")}
        emptyAction={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />{t("appointments.create")}</Button>}
        columns={[
          { header: t("appointments.dateTime"), cell: (appointment) => formatDateTime(appointment.start_at) },
          { header: t("common.client"), cell: (appointment) => clients.data?.find((client) => client.id === appointment.client)?.full_name || "-" },
          { header: t("appointment.service"), cell: (appointment) => services.data?.find((service) => service.id === appointment.service)?.name || "-" },
          { header: t("appointment.resource"), cell: (appointment) => resources.data?.find((resource) => resource.id === appointment.resource)?.name || t("calendar.noResource") },
          { header: t("appointment.status"), cell: (appointment) => <StatusBadge status={appointment.status} /> },
          { header: t("appointment.source"), cell: (appointment) => appointment.source },
          {
            header: t("appointments.actions"),
            cell: (appointment) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setDrawerEntity({ type: "appointment", id: appointment.id })}>{t("appointments.card")}</Button>
                {quickStatuses.filter((item) => item !== appointment.status).slice(0, 2).map((nextStatus) => (
                  <Button
                    key={nextStatus}
                    variant="secondary"
                    className="min-h-9 rounded-full px-3 py-1 text-xs"
                    onClick={() => statusMutation.mutate({ id: appointment.id, status: nextStatus })}
                    isLoading={statusMutation.isPending}
                  >
                    {statusLabels[nextStatus]}
                  </Button>
                ))}
                <Button variant="ghost" onClick={() => { setEditing(appointment); setOpen(true); }}>{t("appointments.edit")}</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const reason = window.prompt(t("appointments.archiveReason"));
                    if (reason !== null) archiveMutation.mutate({ id: appointment.id, reason });
                  }}
                >
                  {t("appointments.archive")}
                </Button>
              </div>
            ),
          },
        ]}
      />
      <Modal title={editing ? t("appointments.editTitle") : t("appointments.create")} open={open} onClose={() => { setOpen(false); setEditing(undefined); }}>
        <AppointmentForm businessId={business.id} clients={clients.data || []} services={services.data || []} resources={resources.data || []} leads={leads.data || []} initial={editing} onSubmit={(payload) => mutation.mutateAsync(payload)} />
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
