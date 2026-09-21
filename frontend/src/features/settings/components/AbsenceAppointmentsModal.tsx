import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";

import { appointmentsApi, type AppointmentReschedulePayload } from "../../../api/appointments";
import { getApiErrorMessage } from "../../../api/client";
import { resourcesApi } from "../../../api/resources";
import { useActionConfirm } from "../../../components/actions/ActionConfirmProvider";
import { AppointmentRescheduleForm } from "../../../components/forms/AppointmentRescheduleForm";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ErrorState, LoadingState } from "../../../components/ui/StateViews";
import { useAuth } from "../../auth/AuthProvider";
import { hasPermission } from "../../../lib/permissions";
import { useI18n } from "../../../lib/i18n";
import type { Appointment, Resource } from "../../../types";

export function AbsenceAppointmentsModal({ resource, date, appointments, loading, error, timeZone, onClose }: {
  resource: Resource; date: string; appointments: Appointment[]; loading: boolean;
  error: unknown; timeZone: string; onClose: () => void;
}) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const confirm = useActionConfirm();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Appointment | null>(null);
  const resources = useQuery({ queryKey: ["resources", "options"], queryFn: resourcesApi.options });
  const canUpdate = hasPermission(user, resource.business, "appointments", "update");
  const mutation = useMutation({
    mutationFn: ({ appointment, payload, reason }: { appointment: Appointment; payload?: AppointmentReschedulePayload; reason?: string }) =>
      payload ? appointmentsApi.reschedule({ id: appointment.id, payload }) : appointmentsApi.cancel(appointment.id, { reason: reason! }),
    onSuccess: async () => {
      setSelected(null);
      await Promise.all(["appointments", "available-slots", "crm-card", "activity-events"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    },
  });
  async function cancel(appointment: Appointment) {
    const result = await confirm({ title: t("appointment.actionCancel"), tone: "warning",
      reason: { label: t("appointments.statusReasonTitle"), required: true } });
    if (result.confirmed) mutation.mutate({ appointment, reason: result.reason });
  }
  return (
    <Modal title={`${resource.name} · ${date}`} open onClose={() => { if (!mutation.isPending) onClose(); }} size="xl" testId="absence-appointments-modal">
      <div className="space-y-4">
        <p className="text-sm text-zani-subtle">{t("appointment.date")}: {date}</p>
        {!loading && !error ? <p className="font-semibold">{t("workingHours.absenceCounts", { count: appointments.length, clients: new Set(appointments.map((item) => item.client)).size })}</p> : null}
        {loading || resources.isLoading ? <LoadingState /> : null}
        {error || mutation.error || resources.error ? <ErrorState message={getApiErrorMessage(error || mutation.error || resources.error)} /> : null}
        {selected ? <AppointmentRescheduleForm appointment={selected} businessId={resource.business} resources={resources.data || []}
          timeZone={timeZone} isSubmitting={mutation.isPending} onCancel={() => setSelected(null)}
          onSubmit={(payload) => mutation.mutateAsync({ appointment: selected, payload })} /> : (
          <ul className="divide-y divide-zani-border">
            {appointments.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <Link className="zani-focus-ring text-sm text-brand-700 underline" to={`/app/calendar?date=${date}&appointment=${item.id}`}>
                {new Date(item.start_at).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", timeZone })} · {item.client_name} · {item.service_name}
              </Link>
              <div className="flex gap-2">
                <Button variant="secondary" type="button" disabled={!canUpdate || mutation.isPending || resources.isLoading || Boolean(resources.error)} onClick={() => setSelected(item)}>{t("workingHours.reassignOrReschedule")}</Button>
                <Button variant="secondary" type="button" disabled={!canUpdate || mutation.isPending} onClick={() => void cancel(item)}>{t("appointment.actionCancel")}</Button>
              </div>
            </li>)}
          </ul>
        )}
        {!loading && !error && !appointments.length ? <p>{t("workingHours.noAppointmentsOnDate")}</p> : null}
        <Button variant="secondary" type="button" disabled={mutation.isPending} onClick={onClose}>{t("common.close")}</Button>
      </div>
    </Modal>
  );
}
