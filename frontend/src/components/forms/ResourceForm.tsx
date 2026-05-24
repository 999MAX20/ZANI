import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useI18n } from "../../lib/i18n";
import type { Id, Resource } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const schema = z.object({
  name: z.string().min(2, "Введите название"),
  resource_type: z.string(),
  is_active: z.boolean(),
});

type Values = z.infer<typeof schema>;

export function ResourceForm({ businessId, initial, onSubmit }: { businessId: Id; initial?: Resource; onSubmit: (payload: Partial<Resource>) => Promise<unknown> }) {
  const { t } = useI18n();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name || "",
      resource_type: initial?.resource_type || "staff",
      is_active: initial?.is_active ?? true,
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit({ ...values, business: businessId } as Partial<Resource>))}>
      <div className="rounded-3xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-slate-700">
        <p className="font-bold text-midnight">{t("resources.formHintTitle")}</p>
        <p className="mt-1 leading-6">
          {t("resources.formHintText")}
        </p>
      </div>
      <Input label={t("resources.name")} placeholder={t("resources.namePlaceholder")} error={form.formState.errors.name?.message} {...form.register("name")} />
      <Select
        label={t("resources.type")}
        options={[
          { value: "staff", label: t("resources.typeStaff") },
          { value: "room", label: t("resources.typeRoom") },
          { value: "hall", label: t("resources.typeHall") },
          { value: "box", label: t("resources.typeBox") },
          { value: "equipment", label: t("resources.typeEquipment") },
          { value: "other", label: t("resources.typeOther") },
        ]}
        {...form.register("resource_type")}
      />
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...form.register("is_active")} />
        {t("resources.available")}
      </label>
      <Button type="submit" isLoading={form.formState.isSubmitting}>{t("resources.save")}</Button>
    </form>
  );
}
