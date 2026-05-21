import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

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
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Appointment } from "../../types";

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { appointments, clients, services, resources, leads } = useEntityData();
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

  const rows = useMemo(() => (appointments.data || []).filter((appointment) => (!date || appointment.start_at.slice(0, 10) === date) && (!status || appointment.status === status)), [appointments.data, date, status]);

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы работать с записями." />;
  if (appointments.isLoading || clients.isLoading || services.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader title="Записи" description="Список всех appointment с быстрым изменением статуса." actions={<Button onClick={() => setOpen(true)}><Plus size={18} />Создать запись</Button>} />
      {mutation.error || archiveMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error || archiveMutation.error)} /></div> : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-[220px_220px]">
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} placeholder={todayISO()} />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: "", label: "Все статусы" }, { value: "created", label: "Создана" }, { value: "confirmed", label: "Подтверждена" }, { value: "cancelled", label: "Отменена" }, { value: "completed", label: "Завершена" }, { value: "no_show", label: "Не пришёл" }]} />
      </div>
      <DataTable
        rows={rows}
        emptyTitle="Записей пока нет"
        emptyDescription={date || status ? "По выбранным фильтрам записей нет. Измените дату или статус." : "Создайте первую запись вручную или из заявки, чтобы она появилась в списке и календаре."}
        emptyAction={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />Создать запись</Button>}
        columns={[
          { header: "Дата/время", cell: (appointment) => formatDateTime(appointment.start_at) },
          { header: "Клиент", cell: (appointment) => clients.data?.find((client) => client.id === appointment.client)?.full_name || "-" },
          { header: "Услуга", cell: (appointment) => services.data?.find((service) => service.id === appointment.service)?.name || "-" },
          { header: "Ресурс", cell: (appointment) => resources.data?.find((resource) => resource.id === appointment.resource)?.name || "-" },
          { header: "Статус", cell: (appointment) => <StatusBadge status={appointment.status} /> },
          { header: "Источник", cell: (appointment) => appointment.source },
          {
            header: "Действия",
            cell: (appointment) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setDrawerEntity({ type: "appointment", id: appointment.id })}>Карточка</Button>
                <Button variant="ghost" onClick={() => { setEditing(appointment); setOpen(true); }}>Изменить</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const reason = window.prompt("Причина архивации записи");
                    if (reason !== null) archiveMutation.mutate({ id: appointment.id, reason });
                  }}
                >
                  Архив
                </Button>
              </div>
            ),
          },
        ]}
      />
      <Modal title={editing ? "Редактировать запись" : "Создать запись"} open={open} onClose={() => { setOpen(false); setEditing(undefined); }}>
        <AppointmentForm businessId={business.id} clients={clients.data || []} services={services.data || []} resources={resources.data || []} leads={leads.data || []} initial={editing} onSubmit={(payload) => mutation.mutateAsync(payload)} />
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
