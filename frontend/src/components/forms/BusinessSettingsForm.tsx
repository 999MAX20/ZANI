import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useI18n } from "../../lib/i18n";
import type { Business } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

function createSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("validation.businessName")),
    slug: z.string().min(2, t("businessForm.slugRequired")),
    business_type: z.string(),
    city: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    telegram: z.string().optional(),
    instagram: z.string().optional(),
    timezone: z.string().min(1),
    status: z.string(),
  });
}

type Values = z.infer<ReturnType<typeof createSchema>>;

export function BusinessSettingsForm({
  initial,
  onSubmit,
}: {
  initial?: Business | null;
  onSubmit: (payload: Partial<Business>) => Promise<unknown>;
}) {
  const { t } = useI18n();
  const form = useForm<Values>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      name: initial?.name || "",
      slug: initial?.slug || "",
      business_type: initial?.business_type || "other",
      city: initial?.city || "",
      address: initial?.address || "",
      phone: initial?.phone || "",
      whatsapp: initial?.whatsapp || "",
      telegram: initial?.telegram || "",
      instagram: initial?.instagram || "",
      timezone: initial?.timezone || "Asia/Almaty",
      status: initial?.status || "trial",
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(values as Partial<Business>))}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("businessForm.name")} error={form.formState.errors.name?.message} {...form.register("name")} />
        <Input label="Slug" error={form.formState.errors.slug?.message} {...form.register("slug")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t("businessForm.type")} options={[
          { value: "dentistry", label: t("businessType.dentistry") },
          { value: "beauty", label: t("businessType.beauty") },
          { value: "sauna", label: t("businessType.sauna") },
          { value: "autoservice", label: t("businessType.autoservice") },
          { value: "education", label: t("businessType.education") },
          { value: "medical", label: t("businessType.medical") },
          { value: "other", label: t("businessType.other") },
        ]} {...form.register("business_type")} />
        <Select label={t("settings.status")} options={[
          { value: "trial", label: t("status.trial") },
          { value: "active", label: t("status.active") },
          { value: "inactive", label: t("status.inactive") },
          { value: "blocked", label: t("status.blocked") },
        ]} {...form.register("status")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("businessForm.city")} {...form.register("city")} />
        <Input label={t("businessForm.address")} {...form.register("address")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("businessForm.phone")} {...form.register("phone")} />
        <Input label={t("businessForm.timezone")} placeholder="Asia/Almaty" {...form.register("timezone")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="WhatsApp" {...form.register("whatsapp")} />
        <Input label="Telegram" {...form.register("telegram")} />
        <Input label="Instagram" {...form.register("instagram")} />
      </div>
      <Button type="submit" isLoading={form.formState.isSubmitting}>{t("businessForm.save")}</Button>
    </form>
  );
}
