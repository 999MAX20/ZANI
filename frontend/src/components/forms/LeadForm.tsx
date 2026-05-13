import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Client, Id, Lead, Service } from "../../types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

const schema = z.object({
  client: z.coerce.number().min(1, "Выберите клиента"),
  service: z.coerce.number().optional(),
  source: z.string(),
  status: z.string(),
  message: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function LeadForm({
  businessId,
  clients,
  services,
  initial,
  onSubmit,
}: {
  businessId: Id;
  clients: Client[];
  services: Service[];
  initial?: Lead;
  onSubmit: (payload: Partial<Lead>) => Promise<unknown>;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      client: initial?.client || clients[0]?.id || 0,
      service: initial?.service || undefined,
      source: initial?.source || "manual",
      status: initial?.status || "new",
      message: initial?.message || "",
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit({ ...values, business: businessId, service: values.service || null } as Partial<Lead>))}>
      <Select label="Клиент" options={[{ value: 0, label: "Выберите клиента" }, ...clients.map((client) => ({ value: client.id, label: `${client.full_name} ${client.phone || ""}` }))]} {...form.register("client")} />
      <Select label="Услуга" options={[{ value: "", label: "Без услуги" }, ...services.map((service) => ({ value: service.id, label: service.name }))]} {...form.register("service")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Источник" options={[
          { value: "manual", label: "Вручную" },
          { value: "website", label: "Сайт" },
          { value: "telegram", label: "Telegram" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "instagram", label: "Instagram" },
          { value: "other", label: "Другое" },
        ]} {...form.register("source")} />
        <Select label="Статус" options={[
          { value: "new", label: "Новая" },
          { value: "in_progress", label: "В работе" },
          { value: "appointment_created", label: "Записан" },
          { value: "contacted", label: "Связались" },
          { value: "closed", label: "Закрыта" },
          { value: "lost", label: "Потеряна" },
        ]} {...form.register("status")} />
      </div>
      <Textarea label="Сообщение" {...form.register("message")} />
      <Button type="submit" isLoading={form.formState.isSubmitting}>Сохранить</Button>
    </form>
  );
}
