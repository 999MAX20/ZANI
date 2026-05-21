import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { leadsApi } from "../../api/leads";
import type { DuplicateClient, Id, Lead, Service, Client } from "../../types";
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
  onOpenClient,
}: {
  businessId: Id;
  clients: Client[];
  services: Service[];
  initial?: Lead;
  onSubmit: (payload: Partial<Lead>) => Promise<unknown>;
  onOpenClient?: (id: Id) => void;
}) {
  const [duplicates, setDuplicates] = useState<DuplicateClient[]>([]);
  const [relatedLeadsCount, setRelatedLeadsCount] = useState(0);
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
  const clientId = form.watch("client");

  useEffect(() => {
    if (!clientId) {
      setDuplicates([]);
      setRelatedLeadsCount(0);
      return;
    }
    const timeout = window.setTimeout(() => {
      leadsApi
        .checkDuplicates({ business: businessId, client: Number(clientId) })
        .then((result) => {
          setDuplicates(result.duplicates);
          setRelatedLeadsCount(result.related_leads.filter((lead) => lead.id !== initial?.id).length);
        })
        .catch(() => {
          setDuplicates([]);
          setRelatedLeadsCount(0);
        });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [businessId, clientId, initial?.id]);

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit({ ...values, business: businessId, service: values.service || null } as Partial<Lead>))}>
      <Select label="Клиент" options={[{ value: 0, label: "Выберите клиента" }, ...clients.map((client) => ({ value: client.id, label: `${client.full_name} ${client.phone || ""}` }))]} {...form.register("client")} />
      {duplicates.length || relatedLeadsCount ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-black">Есть похожий клиент или активная история</p>
          <p className="mt-1 text-amber-800">
            {relatedLeadsCount ? `У выбранного клиента уже есть заявок: ${relatedLeadsCount}. ` : ""}
            Проверьте историю перед созданием новой заявки.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {duplicates.slice(0, 2).map((client) => (
              <Button key={client.id} type="button" variant="secondary" className="h-9 rounded-xl px-3 text-xs" onClick={() => onOpenClient?.(client.id)}>
                Открыть существующего клиента
              </Button>
            ))}
            {!duplicates.length && clientId && onOpenClient ? (
              <Button type="button" variant="secondary" className="h-9 rounded-xl px-3 text-xs" onClick={() => onOpenClient(Number(clientId))}>
                Открыть существующего клиента
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
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
      <Button type="submit" isLoading={form.formState.isSubmitting}>{duplicates.length || relatedLeadsCount ? "Создать всё равно" : "Сохранить"}</Button>
    </form>
  );
}
