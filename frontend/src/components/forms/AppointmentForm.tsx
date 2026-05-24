import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { appointmentsApi } from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { workingHoursApi } from "../../api/workingHours";
import { todayISO } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Client, Id, Lead, Resource, Service } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

function createSchema(t: (key: string) => string) {
  return z.object({
    client: z.coerce.number().min(1, t("appointment.selectClient")),
    service: z.coerce.number().min(1, t("appointment.selectService")),
    resource: z.coerce.number().optional(),
    lead: z.coerce.number().optional(),
    date: z.string().min(1, t("appointment.dateRequired")),
    slot: z.string().optional(),
    status: z.string(),
    source: z.string(),
    notes: z.string().optional(),
  });
}

type Values = z.infer<ReturnType<typeof createSchema>>;

function SetupNotice({
  title,
  description,
  to,
  action,
}: {
  title: string;
  description: string;
  to: string;
  action: string;
}) {
  return (
    <div className="rounded-3xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-900">
      <p className="font-bold">{title}</p>
      <p className="mt-1 leading-6 text-amber-800">{description}</p>
      <Link className="mt-3 inline-flex font-bold text-amber-950 underline-offset-4 hover:underline" to={to}>
        {action}
      </Link>
    </div>
  );
}

export function AppointmentForm({
  businessId,
  clients,
  services,
  resources,
  leads,
  initial,
  prefill,
  onSubmit,
}: {
  businessId: Id;
  clients: Client[];
  services: Service[];
  resources: Resource[];
  leads: Lead[];
  initial?: Appointment;
  prefill?: {
    client?: Id | null;
    service?: Id | null;
    lead?: Id | null;
    date?: string;
    slot?: string;
    source?: Appointment["source"];
  };
  onSubmit: (payload: Partial<Appointment>) => Promise<unknown>;
}) {
  const { t, language } = useI18n();
  const form = useForm<Values>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      client: initial?.client || prefill?.client || clients[0]?.id || 0,
      service: initial?.service || prefill?.service || services[0]?.id || 0,
      resource: initial?.resource || undefined,
      lead: initial?.lead || prefill?.lead || undefined,
      date: initial?.start_at?.slice(0, 10) || prefill?.date || todayISO(),
      slot: initial?.start_at || prefill?.slot || "",
      status: initial?.status || "created",
      source: initial?.source || prefill?.source || "manual",
      notes: initial?.notes || "",
    },
  });

  const serviceId = form.watch("service");
  const resourceId = form.watch("resource");
  const date = form.watch("date");
  const skipSlotResetRef = useRef(true);
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const selectedService = services.find((service) => service.id === Number(serviceId));
  const hasClients = clients.length > 0;
  const hasServices = services.length > 0;
  const activeResources = resources.filter((resource) => resource.is_active);
  const hasResources = activeResources.length > 0;
  const selectedDateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(language === "en" ? "en-US" : language === "kk" ? "kk-KZ" : "ru-RU", { weekday: "long", day: "2-digit", month: "long" });
  const quickHoursMutation = useMutation({
    mutationFn: () => workingHoursApi.applyPreset({ business: businessId, preset: "daily_9_20", resource: resourceId ? Number(resourceId) : "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["working-hours"] });
      queryClient.invalidateQueries({ queryKey: ["available-slots"] });
      setSubmitError(null);
    },
    onError: (error) => setSubmitError(getApiErrorMessage(error)),
  });

  const slots = useQuery({
    queryKey: ["available-slots", businessId, serviceId, resourceId, date],
    queryFn: () =>
      appointmentsApi.availableSlots({
        business_id: businessId,
        service_id: Number(serviceId),
        resource_id: resourceId ? Number(resourceId) : "",
        date,
      }),
    enabled: Boolean(businessId && serviceId && date && !initial),
  });
  const noSlots = !initial && !slots.isLoading && slots.data?.length === 0;

  useEffect(() => {
    if (!initial) {
      if (skipSlotResetRef.current) {
        skipSlotResetRef.current = false;
        return;
      }
      form.setValue("slot", "");
      setSubmitError(null);
    }
  }, [date, serviceId, resourceId, initial, form]);

  useEffect(() => {
    if (!initial && activeResources.length && !form.getValues("resource")) {
      form.setValue("resource", activeResources[0].id);
    }
  }, [activeResources.length, form, initial]);

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        setSubmitError(null);
        const startAt = initial?.start_at || values.slot;
        if (!initial && hasResources && !values.resource) {
          form.setError("resource", { message: t("appointment.selectResourceError") });
          return;
        }
        if (!initial && !startAt) {
          form.setError("slot", { message: t("appointment.selectSlotError") });
          return;
        }
        const duration = selectedService?.duration_minutes || 30;
        const endAt = new Date(startAt || Date.now());
        endAt.setMinutes(endAt.getMinutes() + duration);
        try {
          await onSubmit({
            business: businessId,
            client: values.client,
            service: values.service,
            resource: values.resource || null,
            lead: values.lead || null,
            start_at: startAt,
            end_at: initial?.end_at || endAt.toISOString(),
            status: values.status as Appointment["status"],
            source: values.source as Appointment["source"],
            notes: values.notes || "",
          });
        } catch (error) {
          setSubmitError(getApiErrorMessage(error));
        }
      })}
    >
      {!hasClients ? (
        <SetupNotice
          title={t("appointment.needClientTitle")}
          description={t("appointment.needClientText")}
          to="/dashboard/clients"
          action={t("appointment.goClients")}
        />
      ) : null}
      {!hasServices ? (
        <SetupNotice
          title={t("appointment.needServiceTitle")}
          description={t("appointment.needServiceText")}
          to="/dashboard/services"
          action={t("appointment.goServices")}
        />
      ) : null}
      {!hasResources ? (
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-bold text-midnight">{t("appointment.resourceHintTitle")}</p>
          <p className="mt-1 leading-6">{t("appointment.resourceHintText")}</p>
          <Link className="mt-3 inline-flex font-bold text-brand-700 underline-offset-4 hover:underline" to="/dashboard/resources">
            {t("appointment.goResources")}
          </Link>
        </div>
      ) : null}
      {hasResources ? (
        <div className="rounded-3xl border border-brand-100 bg-brand-50/70 p-4 text-sm text-brand-900">
          <p className="font-bold">{t("appointment.resourceSelectedTitle")}</p>
          <p className="mt-1 leading-6">{t("appointment.resourceSelectedText")}</p>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t("appointment.client")} error={form.formState.errors.client?.message} options={[{ value: 0, label: t("appointment.selectClient") }, ...clients.map((client) => ({ value: client.id, label: client.full_name }))]} {...form.register("client")} />
        <Select label={t("appointment.service")} error={form.formState.errors.service?.message} options={[{ value: 0, label: t("appointment.selectService") }, ...services.map((service) => ({ value: service.id, label: `${service.name} · ${service.duration_minutes} ${t("appointment.minutes")}` }))]} {...form.register("service")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t("appointment.resource")}
          error={form.formState.errors.resource?.message}
          options={[
            { value: "", label: hasResources ? t("appointment.selectResource") : t("appointment.noResource") },
            ...activeResources.map((resource) => ({ value: resource.id, label: resource.name })),
          ]}
          {...form.register("resource")}
        />
        <Select label={t("appointment.lead")} options={[{ value: "", label: t("appointment.noLead") }, ...leads.map((lead) => ({ value: lead.id, label: `${t("appointment.lead")} #${lead.id}` }))]} {...form.register("lead")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("appointment.date")} type="date" error={form.formState.errors.date?.message} {...form.register("date")} disabled={Boolean(initial)} />
        {initial ? (
          <Input label={t("appointment.time")} value={new Date(initial.start_at).toLocaleTimeString(language === "en" ? "en-US" : "ru-RU", { hour: "2-digit", minute: "2-digit" })} readOnly />
        ) : (
          <Select
            label={t("appointment.slot")}
            error={form.formState.errors.slot?.message}
            options={[
              {
                value: "",
                label: slots.isLoading
                  ? t("appointment.loadingSlots")
                  : slots.data?.length === 0
                    ? t("appointment.noSlots")
                    : t("appointment.selectTime"),
              },
              ...(slots.data || []).map((slot) => ({
                value: slot.start_at,
                label: new Date(slot.start_at).toLocaleTimeString(language === "en" ? "en-US" : "ru-RU", { hour: "2-digit", minute: "2-digit" }),
              })),
            ]}
            {...form.register("slot")}
          />
        )}
      </div>
      {slots.error ? (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
          {getApiErrorMessage(slots.error)}
        </div>
      ) : null}
      {noSlots ? (
        <div className="rounded-3xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-900">
          <p className="font-bold">{t("appointment.noSlotsForDate").replace("{date}", selectedDateLabel)}</p>
          <p className="mt-1 leading-6 text-amber-800">
            {t("appointment.noSlotsReason")}
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-800">
            <li>{t("appointment.reasonHours")}</li>
            <li>{t("appointment.reasonResource")}</li>
            <li>{t("appointment.reasonBusy")}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" isLoading={quickHoursMutation.isPending} onClick={() => quickHoursMutation.mutate()}>
              {t("appointment.applyQuickHours")}
            </Button>
            <Link className="inline-flex min-h-10 items-center rounded-2xl px-4 py-2 font-bold text-amber-950 underline-offset-4 hover:underline" to="/dashboard/working-hours">
              {t("appointment.openHours")}
            </Link>
          </div>
        </div>
      ) : null}
      {submitError ? (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
          {submitError}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t("appointment.status")} options={[
          { value: "created", label: t("appointment.statusCreated") },
          { value: "confirmed", label: t("appointment.statusConfirmed") },
          { value: "cancelled", label: t("appointment.statusCancelled") },
          { value: "rescheduled", label: t("appointment.statusRescheduled") },
          { value: "completed", label: t("appointment.statusCompleted") },
          { value: "no_show", label: t("appointment.statusNoShow") },
        ]} {...form.register("status")} />
        <Select label={t("appointment.source")} options={[
          { value: "manual", label: t("appointment.sourceManual") },
          { value: "website", label: t("appointment.sourceWebsite") },
          { value: "telegram", label: "Telegram" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "instagram", label: "Instagram" },
          { value: "bot", label: "Bot" },
        ]} {...form.register("source")} />
      </div>
      <Textarea label={t("appointment.notes")} {...form.register("notes")} />
      <Button type="submit" isLoading={form.formState.isSubmitting} disabled={!initial && (!hasClients || !hasServices || slots.isLoading || slots.data?.length === 0)}>
        {initial ? t("appointment.save") : t("appointment.create")}
      </Button>
    </form>
  );
}
