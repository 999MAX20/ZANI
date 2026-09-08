import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
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

export function ServiceForm({
  businessId,
  initial,
  onSubmit,
  formId,
  showSubmit = true,
  showContextHint = !initial,
  disabled = false,
  onDirtyChange,
}: {
  businessId: Id;
  initial?: Service;
  onSubmit: (payload: Partial<Service>) => Promise<unknown>;
  formId?: string;
  showSubmit?: boolean;
  showContextHint?: boolean;
  disabled?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}) {
  const { t } = useI18n();
  const form = useForm<Values>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      name: initial?.name || "",
      description: initial?.description || "",
      duration_minutes: initial?.duration_minutes || 30,
      price_from: initial?.price_from || "",
    },
  });
  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  function applyTemplate(template: ServiceTemplate) {
    form.setValue("name", t(`services.template.${template.key}.name`), { shouldDirty: true, shouldValidate: true });
    form.setValue("description", t(`services.template.${template.key}.description`), { shouldDirty: true });
    form.setValue("duration_minutes", template.durationMinutes, { shouldDirty: true, shouldValidate: true });
    form.setValue("price_from", template.priceFrom, { shouldDirty: true });
  }

  return (
    <form
      id={formId}
      className="grid gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({ ...values, business: businessId, price_from: values.price_from || null });
        form.reset(values);
      })}
    >
      {showContextHint ? (
        <div className="rounded-card border border-brand-100 bg-brand-50 p-4 text-sm text-zani-subtle">
          <p className="font-semibold text-zani-ink">{t("services.formHintTitle")}</p>
          <p className="mt-1 leading-6">{t("services.formHintText")}</p>
        </div>
      ) : null}
      {!initial ? (
        <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
          <p className="text-sm font-semibold text-zani-ink">{t("services.templatesTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-zani-muted">{t("services.templatesText")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {serviceTemplates.map((template) => (
              <Button key={template.key} type="button" variant="secondary" disabled={disabled} onClick={() => applyTemplate(template)}>
                {t(`services.template.${template.key}.name`)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      <Input disabled={disabled} label={t("services.name")} error={form.formState.errors.name?.message} {...form.register("name")} />
      <Textarea disabled={disabled} label={t("services.descriptionField")} {...form.register("description")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input disabled={disabled} label={t("services.durationMinutes")} type="number" min={15} {...form.register("duration_minutes")} />
        <Input disabled={disabled} label={t("services.priceFrom")} type="number" min={0} step="0.01" {...form.register("price_from")} />
      </div>
      {showSubmit ? <Button type="submit" disabled={disabled} isLoading={form.formState.isSubmitting}>{t("services.save")}</Button> : null}
    </form>
  );
}
