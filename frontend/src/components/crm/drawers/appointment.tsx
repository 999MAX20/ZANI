import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardList, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { appointmentsApi } from "../../../api/appointments";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { CrmCardPayload } from "../../../types";
import { Button } from "../../ui/Button";
import { ErrorState } from "../../ui/StateViews";
import { StatusBadge } from "../../ui/StatusBadge";
import { Textarea } from "../../ui/Textarea";
import { EntityAttachmentsPanel, EntityCustomFieldsPanel } from "./panels";
import { EmptyBlock, SummaryItem, getChannelLabel } from "./shared";
import type { CrmDrawerEntity } from "./types";

type AppointmentAction = "confirmed" | "cancelled" | "completed" | "no_show";

function sourceLabel(source: string, t: (key: string) => string) {
  return t(`appointment.source.${source}`) || getChannelLabel(source, t);
}

export function AppointmentDrawerContent({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const appointment = data.appointment;
  const client = data.client;
  const lead = data.lead;
  const [notes, setNotes] = useState(appointment?.notes || "");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setNotes(appointment?.notes || "");
    setNotice("");
  }, [appointment?.id, appointment?.notes]);

  const notesMutation = useMutation({
    mutationFn: async () => {
      if (!appointment) throw new Error("Appointment is required.");
      return appointmentsApi.update({ id: appointment.id, payload: { notes } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setNotice(t("common.saved"));
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: async (action: AppointmentAction) => {
      if (!appointment) throw new Error("Appointment is required.");
      if (action === "confirmed") return appointmentsApi.confirm(appointment.id);
      if (action === "cancelled") return appointmentsApi.cancel(appointment.id);
      if (action === "completed") return appointmentsApi.complete(appointment.id);
      return appointmentsApi.noShow(appointment.id);
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["activity-events"] });
      const labels: Record<AppointmentAction, string> = {
        confirmed: t("appointment.statusConfirmed"),
        cancelled: t("appointment.statusCancelled"),
        completed: t("appointment.statusCompleted"),
        no_show: t("appointment.statusNoShow"),
      };
      setNotice(labels[action]);
    },
  });

  if (!appointment) return <EmptyBlock title={t("crmCard.appointmentNumber", { id: entity.id })} text={t("crmCard.loadError")} />;

  const isTerminal = ["cancelled", "completed", "no_show"].includes(appointment.status);
  const clientName = client?.full_name || appointment.client_name || `#${appointment.client}`;
  const serviceName = appointment.service_name || `#${appointment.service}`;
  const serviceMeta = appointment.service_duration_minutes ? `${serviceName} · ${appointment.service_duration_minutes} ${t("appointment.minutes")}` : serviceName;
  const resourceName = appointment.resource_name || (appointment.resource ? `#${appointment.resource}` : t("appointment.noResource"));

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-brand-100 bg-white/90 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={appointment.status} />
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{sourceLabel(appointment.source, t)}</span>
            </div>
            <h3 className="truncate text-xl font-black text-midnight">{clientName}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {serviceMeta} · {formatDateTime(appointment.start_at)} - {formatDateTime(appointment.end_at)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {appointment.status !== "confirmed" && !isTerminal ? (
              <Button size="sm" variant="secondary" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate("confirmed")}>
                {t("appointment.actionConfirm")}
              </Button>
            ) : null}
            {appointment.status !== "completed" && appointment.status !== "cancelled" ? (
              <Button size="sm" variant="secondary" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate("completed")}>
                {t("appointment.actionComplete")}
              </Button>
            ) : null}
            {appointment.status !== "no_show" && appointment.status !== "cancelled" && appointment.status !== "completed" ? (
              <Button size="sm" variant="secondary" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate("no_show")}>
                {t("appointment.actionNoShow")}
              </Button>
            ) : null}
            {appointment.status !== "cancelled" && appointment.status !== "completed" ? (
              <Button size="sm" variant="secondary" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate("cancelled")}>
                {t("appointment.actionCancel")}
              </Button>
            ) : null}
          </div>
        </div>
        {notice ? <div className="mt-3 rounded-2xl border border-green-100 bg-green-50 px-3 py-2 text-sm font-bold text-green-800">{notice}</div> : null}
        {notesMutation.error || lifecycleMutation.error ? <div className="mt-3"><ErrorState message={t("crmCard.saveError")} /></div> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem icon={UserRound} label={t("appointment.client")} value={clientName} />
        <SummaryItem icon={ClipboardList} label={t("appointment.service")} value={serviceMeta} />
        <SummaryItem icon={CalendarClock} label={t("appointment.resource")} value={resourceName} />
        <SummaryItem icon={CheckCircle2} label={t("appointment.source")} value={sourceLabel(appointment.source, t)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-3xl border border-brand-100 bg-brand-50/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-700">{t("nav.calendar")}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{formatDateTime(appointment.start_at)}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("nav.leads")}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{lead ? t("crmCard.leadNumber", { id: lead.id }) : t("appointment.noLead")}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("nav.deals")}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{data.deals.length}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-midnight">{t("appointment.notes")}</h3>
            <p className="mt-1 text-sm text-slate-500">{t("crmCard.quickEditText")}</p>
          </div>
          <Button type="button" variant="secondary" isLoading={notesMutation.isPending} onClick={() => notesMutation.mutate()}>
            {t("clients.save")}
          </Button>
        </div>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("crmCard.commentPlaceholder")} />
      </div>

      <EntityCustomFieldsPanel data={data} entity={entity} />
      <EntityAttachmentsPanel data={data} />
    </div>
  );
}
