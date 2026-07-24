import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  appointmentsApi,
  type AppointmentReschedulePayload,
} from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { crmCardsApi } from "../../api/crmCards";
import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import { useActionFeedback } from "../../components/actions/useActionFeedback";
import {
  EntityWorkspaceEmptyState,
  EntityWorkspaceErrorState,
  EntityWorkspaceAside,
  EntityWorkspaceAvatar,
  EntityWorkspaceBody,
  EntityWorkspaceHeader,
  EntityWorkspaceLoadingState,
  EntityWorkspaceMain,
  EntityWorkspaceMetrics,
  EntityWorkspaceRoot,
} from "../../components/crm";
import { AppointmentRescheduleForm } from "../../components/forms/AppointmentRescheduleForm";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Modal } from "../../components/ui/Modal";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { ActivityEvent, Appointment, Task } from "../../types";
import { useAuth } from "../auth/AuthProvider";
import { canAccessAppointmentAction } from "./appointmentAccess";

function asNumericId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getAllowedStatusActions(appointment: Appointment) {
  if (appointment.status === "created" || appointment.status === "rescheduled")
    return ["confirmed", "cancelled"] as Appointment["status"][];
  if (appointment.status === "confirmed")
    return ["completed", "cancelled", "no_show"] as Appointment["status"][];
  return [] as Appointment["status"][];
}

export function AppointmentWorkspacePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const confirmAction = useActionConfirm();
  const { notifyError, notifySuccess } = useActionFeedback();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const { resources } = useEntityData({ resources: true });
  const { id: routeId } = useParams();
  const appointmentId = asNumericId(routeId);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const cardQuery = useQuery({
    queryKey: ["crm-card", "appointment", appointmentId],
    queryFn: () =>
      crmCardsApi.get({ type: "appointment", id: appointmentId as number }),
    enabled: Boolean(appointmentId),
  });

  const appointment = cardQuery.data?.appointment || null;
  const client = cardQuery.data?.client || null;
  const lead = cardQuery.data?.lead || null;
  const tasks = cardQuery.data?.tasks || [];
  const timeline = cardQuery.data?.timeline || [];
  const canUpdateAppointment = appointment
    ? canAccessAppointmentAction({
        appointment,
        resources: resources.data || [],
        user,
        businessId: business?.id,
      })
    : false;
  const statusActions =
    appointment && canUpdateAppointment
      ? getAllowedStatusActions(appointment)
      : [];
  const canReschedule =
    appointment && canUpdateAppointment
      ? !["completed", "cancelled", "no_show"].includes(appointment.status)
      : false;

  const invalidateAppointment = async (updated?: Appointment) => {
    if (updated)
      queryClient.setQueryData(["appointments", updated.id], updated);
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["crm-card", "appointment", appointmentId],
      }),
      queryClient.invalidateQueries({ queryKey: ["appointments"] }),
      queryClient.invalidateQueries({ queryKey: ["available-slots"] }),
      queryClient.invalidateQueries({ queryKey: ["activity-events"] }),
    ]);
  };

  const statusMutation = useMutation<
    Appointment,
    Error,
    { status: Appointment["status"]; reason?: string }
  >({
    mutationFn: ({ status, reason }) => {
      if (!appointmentId) throw new Error(t("appointments.title"));
      if (status === "confirmed") return appointmentsApi.confirm(appointmentId);
      if (status === "cancelled")
        return appointmentsApi.cancel(appointmentId, { reason: reason || "" });
      if (status === "completed")
        return appointmentsApi.complete(appointmentId);
      if (status === "no_show")
        return appointmentsApi.noShow(appointmentId, { reason: reason || "" });
      return appointmentsApi.get(appointmentId);
    },
    onSuccess: async (updated) => {
      notifySuccess(t("appointments.actionDone"));
      await invalidateAppointment(updated);
    },
    onError: (error) => notifyError(error),
  });

  const rescheduleMutation = useMutation<
    Appointment,
    Error,
    AppointmentReschedulePayload
  >({
    mutationFn: (payload) => {
      if (!appointmentId) throw new Error(t("appointments.title"));
      return appointmentsApi.reschedule({ id: appointmentId, payload });
    },
    onSuccess: async (updated) => {
      setRescheduleOpen(false);
      notifySuccess(t("appointments.rescheduledNotice"));
      await invalidateAppointment(updated);
    },
    onError: (error) =>
      notifyError(error, {
        actionLabel: t("common.refresh"),
        retry: () => invalidateAppointment(),
      }),
  });

  async function requestReasonAction(status: Appointment["status"]) {
    const result = await confirmAction({
      title: t("appointments.statusReasonTitle"),
      description: t("appointments.statusReasonPlaceholder"),
      confirmLabel: getAppointmentActionLabel(status, t),
      variant: status === "cancelled" ? "danger" : "primary",
      reason: {
        label: t("appointments.statusReason"),
        placeholder: t("appointments.statusReasonPlaceholder"),
        required: true,
        minLength: 3,
      },
    });
    if (!result.confirmed || !result.reason) return;
    statusMutation.mutate({ status, reason: result.reason });
  }

  if (!appointmentId)
    return <EntityWorkspaceErrorState message={t("appointments.title")} />;
  if (cardQuery.isLoading || resources.isLoading)
    return <EntityWorkspaceLoadingState />;
  const pageError = cardQuery.error || resources.error;
  if (pageError)
    return (
      <EntityWorkspaceErrorState message={getApiErrorMessage(pageError)} />
    );
  if (!appointment) {
    return (
      <EntityWorkspaceEmptyState
        title={t("appointments.title")}
        description={t("calendar.freeDayHint")}
      />
    );
  }

  const title =
    client?.full_name || appointment.client_name || t("common.client");
  const subtitle = [
    appointment.service_name || t("common.service"),
    formatDateTime(appointment.start_at),
    appointment.resource_name || t("appointment.noResource"),
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <>
      <EntityWorkspaceRoot>
        <EntityWorkspaceHeader
          backLabel={t("common.back")}
          onBack={() => navigate("/app/calendar")}
          avatar={
            <EntityWorkspaceAvatar>
              {title.slice(0, 2).toUpperCase()}
            </EntityWorkspaceAvatar>
          }
          title={title}
          subtitle={subtitle}
          status={appointment.status}
          actions={
            <>
              {client ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(`/app/clients/${client.id}`)}
                >
                  {t("leads.openClient")}
                </Button>
              ) : null}
              {lead ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(`/app/leads/${lead.id}`)}
                >
                  {t("crmCard.leadNumber", { id: lead.id })}
                </Button>
              ) : null}
            </>
          }
        />

        <EntityWorkspaceMetrics>
          <AppointmentMetric
            label={t("tasks.status")}
            value={t(`status.${appointment.status}`)}
          />
          <AppointmentMetric
            label={t("common.service")}
            value={appointment.service_name || t("common.service")}
          />
          <AppointmentMetric
            label={t("appointment.resource")}
            value={appointment.resource_name || t("appointment.noResource")}
          />
          <AppointmentMetric
            label={t("tasks.dueAt")}
            value={formatDateTime(appointment.start_at)}
          />
          <AppointmentMetric label={t("nav.tasks")} value={tasks.length} />
        </EntityWorkspaceMetrics>

        <EntityWorkspaceBody>
          <EntityWorkspaceAside>
            <AppointmentSection title={t("calendar.visit")}>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={appointment.status} />
                <StatusBadge status={appointment.source} />
              </div>
              <div className="mt-3 space-y-2 text-sm font-semibold text-zani-subtle">
                <MetaRow
                  label={t("tasks.dueAt")}
                  value={formatDateTime(appointment.start_at)}
                />
                <MetaRow
                  label={t("appointment.source")}
                  value={t(`appointment.source.${appointment.source}`)}
                />
                {appointment.notes ? (
                  <p className="rounded-control bg-surface-subtle p-3 leading-6">
                    {appointment.notes}
                  </p>
                ) : null}
              </div>
            </AppointmentSection>

            <AppointmentSection title={t("appointments.actions")}>
              <div className="grid gap-2">
                {statusActions.map((status, index) => (
                  <Button
                    key={status}
                    data-appointment-action-id={status}
                    type="button"
                    variant={
                      status === "cancelled" || status === "no_show"
                        ? "danger"
                        : index === 0
                          ? "primary"
                          : "secondary"
                    }
                    isLoading={statusMutation.isPending}
                    onClick={() => {
                      if (status === "cancelled" || status === "no_show")
                        void requestReasonAction(status);
                      else statusMutation.mutate({ status });
                    }}
                  >
                    {getAppointmentActionIcon(status)}
                    {getAppointmentActionLabel(status, t)}
                  </Button>
                ))}
                {canReschedule ? (
                  <Button
                    data-appointment-action-id="reschedule"
                    type="button"
                    variant="secondary"
                    onClick={() => setRescheduleOpen(true)}
                  >
                    <RotateCcw size={16} /> {t("appointments.reschedule")}
                  </Button>
                ) : null}
              </div>
            </AppointmentSection>
          </EntityWorkspaceAside>

          <EntityWorkspaceMain>
            <AppointmentSection title={t("tasks.links")}>
              <div className="flex flex-wrap gap-2">
                {client ? (
                  <EntityLink
                    onClick={() => navigate(`/app/clients/${client.id}`)}
                  >
                    {client.full_name || t("common.client")}
                  </EntityLink>
                ) : null}
                {lead ? (
                  <EntityLink onClick={() => navigate(`/app/leads/${lead.id}`)}>
                    {t("crmCard.leadNumber", { id: lead.id })}
                  </EntityLink>
                ) : null}
                {!client && !lead ? (
                  <p className="text-sm font-semibold text-zani-subtle">
                    {t("tasks.noLinkedEntities")}
                  </p>
                ) : null}
              </div>
            </AppointmentSection>

            <AppointmentSection title={t("nav.tasks")}>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={() => navigate(`/app/tasks/${task.id}`)}
                  />
                ))}
                {!tasks.length ? (
                  <p className="text-sm font-semibold text-zani-subtle">
                    {t("tasks.emptyText")}
                  </p>
                ) : null}
              </div>
            </AppointmentSection>

            <AppointmentSection
              title={t("tasks.history")}
              className="lg:col-span-2"
            >
              <div className="space-y-2">
                {timeline.slice(0, 16).map((event) => (
                  <ActivityRow key={event.id} event={event} />
                ))}
                {!timeline.length ? (
                  <p className="text-sm font-semibold text-zani-subtle">
                    {t("tasks.noHistory")}
                  </p>
                ) : null}
              </div>
            </AppointmentSection>
          </EntityWorkspaceMain>
        </EntityWorkspaceBody>
      </EntityWorkspaceRoot>

      <Modal
        title={t("appointments.rescheduleTitle")}
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
      >
        <AppointmentRescheduleForm
          appointment={appointment}
          businessId={appointment.business}
          resources={resources.data || []}
          onCancel={() => setRescheduleOpen(false)}
          onSubmit={(payload) => rescheduleMutation.mutateAsync(payload)}
          isSubmitting={rescheduleMutation.isPending}
          timeZone={business?.timezone || "Asia/Almaty"}
        />
      </Modal>
    </>
  );
}

function getAppointmentActionLabel(
  status: Appointment["status"],
  t: (key: string) => string,
) {
  if (status === "confirmed") return t("appointment.actionConfirm");
  if (status === "completed") return t("appointment.actionComplete");
  if (status === "cancelled") return t("appointment.actionCancel");
  if (status === "no_show") return t("appointment.actionNoShow");
  return t(`status.${status}`);
}

function getAppointmentActionIcon(status: Appointment["status"]) {
  if (status === "confirmed" || status === "completed")
    return <Check size={16} />;
  if (status === "cancelled" || status === "no_show") return <X size={16} />;
  return <CalendarClock size={16} />;
}

function AppointmentMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-card border border-zani-border bg-zani-card px-4 py-3">
      <p className="text-xs font-semibold uppercase text-zani-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-zani-text">{value}</p>
    </div>
  );
}

function AppointmentSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <h2 className="mb-3 text-sm font-semibold text-zani-text">{title}</h2>
      <div className="rounded-card border border-zani-border bg-zani-card p-4 shadow-zani-card">
        {children}
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control bg-surface-subtle px-3 py-2">
      <span>{label}</span>
      <span className="text-right text-zani-text">{value}</span>
    </div>
  );
}

function EntityLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="w-full rounded-card border border-zani-border bg-surface-subtle p-3 text-left transition hover:border-brand-200 hover:bg-brand-50"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zani-text">
            {task.title}
          </p>
          <p className="mt-1 text-xs font-semibold text-zani-muted">
            {task.due_at ? formatDateTime(task.due_at) : t("tasks.groupNoDue")}
          </p>
        </div>
        <StatusBadge status={task.status} />
      </div>
    </button>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex gap-3 rounded-card bg-surface-subtle p-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-zani-card text-brand-600">
        <CalendarClock size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zani-text">
          {event.text || event.event_type}
        </p>
        <p className="mt-1 text-xs font-semibold text-zani-muted">
          {formatDateTime(event.created_at)}
        </p>
      </div>
    </div>
  );
}
