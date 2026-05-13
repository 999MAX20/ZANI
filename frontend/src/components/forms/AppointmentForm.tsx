import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { appointmentsApi } from "../../api/appointments";
import { todayISO } from "../../lib/format";
import type { Appointment, Client, Id, Lead, Resource, Service } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

const schema = z.object({
  client: z.coerce.number().min(1),
  service: z.coerce.number().min(1),
  resource: z.coerce.number().optional(),
  lead: z.coerce.number().optional(),
  date: z.string().min(1),
  slot: z.string().optional(),
  status: z.string(),
  source: z.string(),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function AppointmentForm({
  businessId,
  clients,
  services,
  resources,
  leads,
  initial,
  onSubmit,
}: {
  businessId: Id;
  clients: Client[];
  services: Service[];
  resources: Resource[];
  leads: Lead[];
  initial?: Appointment;
  onSubmit: (payload: Partial<Appointment>) => Promise<unknown>;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      client: initial?.client || clients[0]?.id || 0,
      service: initial?.service || services[0]?.id || 0,
      resource: initial?.resource || undefined,
      lead: initial?.lead || undefined,
      date: initial?.start_at?.slice(0, 10) || todayISO(),
      slot: initial?.start_at || "",
      status: initial?.status || "created",
      source: initial?.source || "manual",
      notes: initial?.notes || "",
    },
  });

  const serviceId = form.watch("service");
  const resourceId = form.watch("resource");
  const date = form.watch("date");
  const selectedService = services.find((service) => service.id === Number(serviceId));

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

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        const startAt = initial?.start_at || values.slot;
        if (!initial && !startAt) {
          form.setError("slot", { message: "Выберите свободный слот" });
          return;
        }
        const duration = selectedService?.duration_minutes || 30;
        const endAt = new Date(startAt || Date.now());
        endAt.setMinutes(endAt.getMinutes() + duration);
        return onSubmit({
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
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Клиент" options={[{ value: 0, label: "Выберите клиента" }, ...clients.map((client) => ({ value: client.id, label: client.full_name }))]} {...form.register("client")} />
        <Select label="Услуга" options={[{ value: 0, label: "Выберите услугу" }, ...services.map((service) => ({ value: service.id, label: service.name }))]} {...form.register("service")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Ресурс" options={[{ value: "", label: "Без ресурса" }, ...resources.map((resource) => ({ value: resource.id, label: resource.name }))]} {...form.register("resource")} />
        <Select label="Заявка" options={[{ value: "", label: "Без заявки" }, ...leads.map((lead) => ({ value: lead.id, label: `Заявка #${lead.id}` }))]} {...form.register("lead")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Дата" type="date" {...form.register("date")} disabled={Boolean(initial)} />
        {initial ? (
          <Input label="Время" value={new Date(initial.start_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} readOnly />
        ) : (
          <Select
            label="Свободный слот"
            error={form.formState.errors.slot?.message}
            options={[
              {
                value: "",
                label: slots.isLoading
                  ? "Загрузка слотов..."
                  : slots.data?.length === 0
                    ? "Нет свободных слотов"
                    : "Выберите время",
              },
              ...(slots.data || []).map((slot) => ({
                value: slot.start_at,
                label: new Date(slot.start_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
              })),
            ]}
            {...form.register("slot")}
          />
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Статус" options={[
          { value: "created", label: "Создана" },
          { value: "confirmed", label: "Подтверждена" },
          { value: "cancelled", label: "Отменена" },
          { value: "rescheduled", label: "Перенесена" },
          { value: "completed", label: "Завершена" },
          { value: "no_show", label: "Не пришёл" },
        ]} {...form.register("status")} />
        <Select label="Источник" options={[
          { value: "manual", label: "Вручную" },
          { value: "website", label: "Сайт" },
          { value: "telegram", label: "Telegram" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "instagram", label: "Instagram" },
          { value: "bot", label: "Bot" },
        ]} {...form.register("source")} />
      </div>
      <Textarea label="Заметки" {...form.register("notes")} />
      <Button type="submit" isLoading={form.formState.isSubmitting} disabled={!initial && slots.data?.length === 0}>Сохранить</Button>
    </form>
  );
}
