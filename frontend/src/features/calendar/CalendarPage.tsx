import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { appointmentsApi } from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { formatDateTime, todayISO } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Appointment } from "../../types";

const hours = Array.from({ length: 11 }, (_, index) => index + 8);
const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPickerDate(value: string) {
  const date = parseDate(value);
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function CalendarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(() => parseDate(value));
  const selected = parseDate(value);
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1)),
  ];

  function shiftMonth(delta: number) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div className="relative w-full sm:w-auto">
      <Button
        variant="secondary"
        className="h-11 w-full justify-between rounded-2xl px-4 sm:min-w-[170px]"
        onClick={() => {
          setMonthDate(parseDate(value));
          setOpen((current) => !current);
        }}
      >
        <span>{formatPickerDate(value)}</span>
        <CalendarDays size={18} />
      </Button>
      {open ? (
        <div className="fixed inset-x-4 top-28 z-30 rounded-3xl border border-slate-200 bg-white p-4 shadow-premium sm:absolute sm:inset-auto sm:right-0 sm:top-14 sm:w-[320px]">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" className="h-9 w-9 rounded-full px-0" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><ChevronLeft size={16} /></Button>
            <p className="font-semibold text-midnight">
              {new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(monthDate)}
            </p>
            <Button variant="ghost" className="h-9 w-9 rounded-full px-0" onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><ChevronRight size={16} /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400">
            {weekDays.map((day) => <div key={day} className="py-2">{day}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              const isSelected = cell && toDateInputValue(cell) === toDateInputValue(selected);
              const isToday = cell && toDateInputValue(cell) === todayISO();
              return (
                <button
                  key={cell ? toDateInputValue(cell) : `empty-${index}`}
                  type="button"
                  disabled={!cell}
                  onClick={() => {
                    if (!cell) return;
                    onChange(toDateInputValue(cell));
                    setOpen(false);
                  }}
                  className={`h-10 rounded-2xl text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-0 ${
                    isSelected
                      ? "bg-ai-gradient text-white shadow-glow"
                      : isToday
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {cell?.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CalendarPage() {
  const { business } = useActiveBusiness();
  const { appointments, clients, services, resources, leads } = useEntityData();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [bookingOpen, setBookingOpen] = useState(false);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Partial<Appointment>) => appointmentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setBookingOpen(false);
    },
  });

  function shiftDate(days: number) {
    const nextDate = parseDate(date);
    nextDate.setDate(nextDate.getDate() + days);
    setDate(toDateInputValue(nextDate));
  }

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы открыть календарь." />;
  if (appointments.isLoading || clients.isLoading || services.isLoading) return <LoadingState />;

  const dayAppointments = (appointments.data || []).filter((item) => item.start_at.slice(0, 10) === date);

  return (
    <>
      <PageHeader
        title="Smart calendar"
        description="Дневная сетка записей без лишних виджетов."
        actions={
          <div className="grid w-full grid-cols-[44px_minmax(0,1fr)_44px] gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button variant="secondary" className="h-11 w-11 px-0" onClick={() => shiftDate(-1)} aria-label="Предыдущий день"><ChevronLeft size={18} /></Button>
            <CalendarPicker value={date} onChange={setDate} />
            <Button variant="secondary" className="h-11 w-11 px-0" onClick={() => shiftDate(1)} aria-label="Следующий день"><ChevronRight size={18} /></Button>
            <Button variant="ai" className="col-span-3 sm:col-span-1" onClick={() => setBookingOpen(true)}><Plus size={18} />New booking</Button>
          </div>
        }
      />
      <div className="grid gap-6">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-semibold text-midnight">Day schedule</h2>
              <p className="text-sm text-slate-500">{dayAppointments.length} appointments planned</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {hours.map((hour) => {
              const items = dayAppointments.filter((appointment) => new Date(appointment.start_at).getHours() === hour);
              return (
                <div key={hour} className="grid min-h-24 grid-cols-[76px_1fr] sm:grid-cols-[110px_1fr]">
                  <div className="bg-slate-50/70 px-4 py-4 text-sm font-semibold text-slate-500">{String(hour).padStart(2, "0")}:00</div>
                  <div className="space-y-3 p-3">
                    {items.map((appointment) => {
                      const client = clients.data?.find((item) => item.id === appointment.client);
                      const service = services.data?.find((item) => item.id === appointment.service);
                      const resource = resources.data?.find((item) => item.id === appointment.resource);
                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          className="w-full rounded-3xl border border-brand-100 bg-gradient-to-r from-brand-50 to-ai-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-premium"
                          onClick={() => setDrawerEntity({ type: "appointment", id: appointment.id })}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-midnight">{client?.full_name || "Client"} · {service?.name || "Service"}</p>
                              <p className="mt-1 text-sm text-slate-500">{formatDateTime(appointment.start_at)} · {resource?.name || "No resource"}</p>
                            </div>
                            <StatusBadge status={appointment.status} />
                          </div>
                        </button>
                      );
                    })}
                    {!items.length ? <div className="h-full rounded-3xl border border-dashed border-slate-200 bg-white/50 p-4 text-sm text-slate-400">Available slot</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      {mutation.error ? <div className="mt-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}

      <Modal title="New booking" open={bookingOpen} onClose={() => setBookingOpen(false)}>
        <AppointmentForm
          businessId={business.id}
          clients={clients.data || []}
          services={services.data || []}
          resources={resources.data || []}
          leads={leads.data || []}
          onSubmit={(payload) => mutation.mutateAsync(payload)}
        />
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
