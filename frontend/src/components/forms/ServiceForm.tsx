import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useI18n } from "../../lib/i18n";
import type { Id, Service } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";

const createSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(2, t("services.nameRequired")),
    description: z.string().optional(),
    duration_minutes: z.coerce.number().min(15),
    price_from: z.string().optional(),
    is_active: z.boolean(),
  });

type Values = z.infer<ReturnType<typeof createSchema>>;

export function ServiceForm({ businessId, initial, onSubmit }: { businessId: Id; initial?: Service; onSubmit: (payload: Partial<Service>) => Promise<unknown> }) {
  const { t } = useI18n();
  const form = useForm<Values>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      name: initial?.name || "",
      description: initial?.description || "",
      duration_minutes: initial?.duration_minutes || 30,
      price_from: initial?.price_from || "",
      is_active: initial?.is_active ?? true,
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit({ ...values, business: businessId, price_from: values.price_from || null }))}>
      <div className="rounded-3xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-slate-700">
        <p className="font-bold text-midnight">{t("services.formHintTitle")}</p>
        <p className="mt-1 leading-6">{t("services.formHintText")}</p>
      </div>
      <Input label={t("services.name")} error={form.formState.errors.name?.message} {...form.register("name")} />
      <Textarea label={t("services.descriptionField")} {...form.register("description")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("services.durationMinutes")} type="number" {...form.register("duration_minutes")} />
        <Input label={t("services.priceFrom")} type="number" step="0.01" {...form.register("price_from")} />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...form.register("is_active")} />
        {t("services.isActive")}
      </label>
      <Button type="submit" isLoading={form.formState.isSubmitting}>{t("services.save")}</Button>
    </form>
  );
}
