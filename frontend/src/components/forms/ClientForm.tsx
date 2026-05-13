import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Client, Id } from "../../types";
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
}: {
  businessId: Id;
  initial?: Client;
  onSubmit: (payload: Partial<Client>) => Promise<unknown>;
}) {
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
      <Button type="submit" isLoading={form.formState.isSubmitting}>Сохранить</Button>
    </form>
  );
}
