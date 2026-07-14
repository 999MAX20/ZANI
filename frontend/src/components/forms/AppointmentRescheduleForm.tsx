import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { appointmentsApi, type AppointmentReschedulePayload } from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { dateInTimeZone, todayInTimeZone } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Id, Resource } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { ErrorState, LoadingState } from "../ui/StateViews";
import { Textarea } from "../ui/Textarea";

export function AppointmentRescheduleForm({
  appointment,
  businessId,
  resources,
  onSubmit,
  onCancel,
  isSubmitting,
  timeZone = "UTC",
}: {
  appointment: Appointment;
  businessId: Id;
  resources: Resource[];
  onSubmit: (payload: AppointmentReschedulePayload) => Promise<unknown>;
  onCancel: () => void;
  isSubmitting?: boolean;
  timeZone?: string;
}) {
  const { t, language } = useI18n();
  const locale = language === "en" ? "en-US" : language === "kk" ? "kk-KZ" : "ru-RU";
  const [date, setDate] = useState(dateInTimeZone(appointment.start_at, timeZone) || todayInTimeZone(timeZone));
  const [resource, setResource] = useState(appointment.resource ? String(appointment.resource) : "");
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const activeResources = resources.filter((item) => item.is_active);

  const slots = useQuery({
    queryKey: ["available-slots", businessId, appointment.service, resource, date, "reschedule", appointment.id],
    queryFn: () =>
      appointmentsApi.availableSlots({
        business_id: businessId,
        service_id: appointment.service,
        resource_id: resource ? Number(resource) : "",
        date,
        exclude_appointment_id: appointment.id,
      }),
    enabled: Boolean(businessId && appointment.service && date),
  });

  const slotOptions = useMemo(
    () =>
      (slots.data || []).map((item) => ({
        value: item.start_at,
        label: `${new Date(item.start_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone })} - ${new Date(item.end_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone })}`,
      })),
    [locale, slots.data, timeZone],
  );

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!slot) {
          setSubmitError(t("appointment.selectSlotError"));
          return;
        }
        setSubmitError(null);
        try {
          await onSubmit({
            start_at: slot,
            resource: resource ? Number(resource) : null,
            reason: reason.trim(),
          });
        } catch (error) {
          setSubmitError(getApiErrorMessage(error));
        }
      }}
    >
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        {t("appointments.currentTime")}: {new Date(appointment.start_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={t("appointment.date")}
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setSlot("");
          }}
        />
        <Select
          label={t("appointment.resource")}
          value={resource}
          onChange={(event) => {
            setResource(event.target.value);
            setSlot("");
          }}
          options={[{ value: "", label: t("appointment.noResource") }, ...activeResources.map((item) => ({ value: String(item.id), label: item.name }))]}
        />
      </div>
      {slots.isLoading ? <LoadingState /> : null}
      {!slots.isLoading ? (
        <Select
          label={t("appointment.time")}
          value={slot}
          onChange={(event) => setSlot(event.target.value)}
          options={[{ value: "", label: slotOptions.length ? t("appointments.selectNewSlot") : t("appointments.noSlots") }, ...slotOptions]}
        />
      ) : null}
      <Textarea label={t("appointments.rescheduleReason")} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("appointments.rescheduleReasonPlaceholder")} />
      {submitError || slots.error ? <ErrorState message={submitError || getApiErrorMessage(slots.error)} /> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {t("appointments.reschedule")}
        </Button>
      </div>
    </form>
  );
}
