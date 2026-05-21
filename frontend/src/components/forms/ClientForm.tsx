import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { clientsApi } from "../../api/clients";
import type { Client, DuplicateClient, Id } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

const schema = z.object({
  full_name: z.string().min(2, "Введите имя"),
  phone: z.string().optional(),
  email: z.string().email("Некорректный email").or(z.literal("")),
  source: z.string(),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function ClientForm({
  businessId,
  initial,
  onSubmit,
  onOpenClient,
  onMergeDuplicate,
}: {
  businessId: Id;
  initial?: Client;
  onSubmit: (payload: Partial<Client>) => Promise<unknown>;
  onOpenClient?: (id: Id) => void;
  onMergeDuplicate?: (duplicateId: Id) => Promise<unknown>;
}) {
  const [duplicates, setDuplicates] = useState<DuplicateClient[]>([]);
  const [duplicateError, setDuplicateError] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: initial?.full_name || "",
      phone: initial?.phone || "",
      email: initial?.email || "",
      source: initial?.source || "manual",
      notes: initial?.notes || "",
    },
  });
  const phone = form.watch("phone");
  const email = form.watch("email");

  useEffect(() => {
    const hasContact = Boolean(phone?.trim() || email?.trim());
    if (!hasContact) {
      setDuplicates([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      clientsApi
        .checkDuplicates({
          business: businessId,
          phone,
          email,
          exclude_client_id: initial?.id,
        })
        .then((result) => {
          setDuplicates(result.duplicates);
          setDuplicateError("");
        })
        .catch(() => setDuplicateError("Не удалось проверить дубли. Можно сохранить и проверить позже."));
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [businessId, email, initial?.id, phone]);

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => onSubmit({ ...values, business: businessId } as Partial<Client>))}
    >
      <Input label="Имя" error={form.formState.errors.full_name?.message} {...form.register("full_name")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Телефон" {...form.register("phone")} />
        <Input label="Email" error={form.formState.errors.email?.message} {...form.register("email")} />
      </div>
      {duplicates.length ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-black">Похожий клиент уже есть в базе</p>
          <p className="mt-1 text-amber-800">Проверьте контакт перед созданием, чтобы не плодить дубли.</p>
          <div className="mt-3 space-y-2">
            {duplicates.slice(0, 3).map((client) => (
              <div key={client.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/70 p-3">
                <span className="font-semibold">{client.full_name} · {client.phone || client.email || "без контакта"}</span>
                {onOpenClient ? (
                  <Button type="button" variant="secondary" className="h-9 rounded-xl px-3 text-xs" onClick={() => onOpenClient(client.id)}>
                    Открыть существующего клиента
                  </Button>
                ) : null}
                {initial && onMergeDuplicate ? (
                  <Button type="button" variant="ghost" className="h-9 rounded-xl px-3 text-xs" onClick={() => onMergeDuplicate(client.id)}>
                    Объединить в текущего
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {duplicateError ? <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">{duplicateError}</div> : null}
      <Select
        label="Источник"
        options={[
          { value: "manual", label: "Вручную" },
          { value: "website", label: "Сайт" },
          { value: "telegram", label: "Telegram" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "instagram", label: "Instagram" },
          { value: "parser", label: "Parser" },
          { value: "other", label: "Другое" },
        ]}
        {...form.register("source")}
      />
      <Textarea label="Заметки" {...form.register("notes")} />
      <Button type="submit" isLoading={form.formState.isSubmitting}>{duplicates.length && !initial ? "Создать всё равно" : "Сохранить"}</Button>
    </form>
  );
}
