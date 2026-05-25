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

type ServiceTemplate = {
  key: string;
  durationMinutes: number;
  priceFrom: string;
};

const serviceTemplates: ServiceTemplate[] = [
  { key: "consultation", durationMinutes: 30, priceFrom: "0" },
  { key: "haircut", durationMinutes: 60, priceFrom: "5000" },
  { key: "beautyProcedure", durationMinutes: 90, priceFrom: "12000" },
  { key: "diagnostics", durationMinutes: 45, priceFrom: "7000" },
];

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

  function applyTemplate(template: ServiceTemplate) {
    form.setValue("name", t(`services.template.${template.key}.name`), { shouldDirty: true, shouldValidate: true });
    form.setValue("description", t(`services.template.${template.key}.description`), { shouldDirty: true });
    form.setValue("duration_minutes", template.durationMinutes, { shouldDirty: true, shouldValidate: true });
    form.setValue("price_from", template.priceFrom, { shouldDirty: true });
    form.setValue("is_active", true, { shouldDirty: true });
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit({ ...values, business: businessId, price_from: values.price_from || null }))}>
      <div className="rounded-3xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-slate-700">
        <p className="font-bold text-midnight">{t("services.formHintTitle")}</p>
        <p className="mt-1 leading-6">{t("services.formHintText")}</p>
      </div>
      {!initial ? (
        <div className="rounded-3xl border border-slate-100 bg-white/80 p-4">
          <p className="text-sm font-black text-midnight">{t("services.templatesTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{t("services.templatesText")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {serviceTemplates.map((template) => (
              <Button key={template.key} type="button" variant="secondary" onClick={() => applyTemplate(template)}>
                {t(`services.template.${template.key}.name`)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
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
