import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useI18n } from "../../lib/i18n";
import type { Business } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

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
    language: z.string().min(1),
    currency: z.string().min(1),
    legal_name: z.string().optional(),
    tax_id: z.string().optional(),
    invoice_email: z.string().email().or(z.literal("")).optional(),
    brand_color: z.string().optional(),
    brand_logo_url: z.string().url().or(z.literal("")).optional(),
    cancellation_policy: z.string().optional(),
    prepayment_policy: z.string().optional(),
    sla_minutes: z.coerce.number().int().min(0),
    booking_buffer_minutes: z.coerce.number().int().min(0),
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
      language: initial?.language || "ru",
      currency: initial?.currency || "KZT",
      legal_name: initial?.legal_name || "",
      tax_id: initial?.tax_id || "",
      invoice_email: initial?.invoice_email || "",
      brand_color: initial?.brand_color || "",
      brand_logo_url: initial?.brand_logo_url || "",
      cancellation_policy: initial?.cancellation_policy || "",
      prepayment_policy: initial?.prepayment_policy || "",
      sla_minutes: initial?.sla_minutes ?? 120,
      booking_buffer_minutes: initial?.booking_buffer_minutes ?? 0,
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(values as Partial<Business>))}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("businessForm.name")} error={form.formState.errors.name?.message} {...form.register("name")} />
        <Input label={t("businessForm.slug")} error={form.formState.errors.slug?.message} {...form.register("slug")} />
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
        <Input label={t("businessForm.timezone")} placeholder="Asia/Almaty" {...form.register("timezone")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("businessForm.city")} {...form.register("city")} />
        <Input label={t("businessForm.address")} {...form.register("address")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("businessForm.phone")} {...form.register("phone")} />
        <Input label="WhatsApp" {...form.register("whatsapp")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Telegram" {...form.register("telegram")} />
        <Input label="Instagram" {...form.register("instagram")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label={t("businessForm.language")} options={[
          { value: "ru", label: t("language.ru") },
          { value: "kk", label: t("language.kk") },
          { value: "en", label: t("language.en") },
        ]} {...form.register("language")} />
        <Select label={t("businessForm.currency")} options={[
          { value: "KZT", label: "KZT" },
          { value: "USD", label: "USD" },
          { value: "EUR", label: "EUR" },
          { value: "RUB", label: "RUB" },
        ]} {...form.register("currency")} />
        <Input label={t("businessForm.slaMinutes")} type="number" error={form.formState.errors.sla_minutes?.message} {...form.register("sla_minutes")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("businessForm.legalName")} {...form.register("legal_name")} />
        <Input label={t("businessForm.taxId")} {...form.register("tax_id")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("businessForm.invoiceEmail")} error={form.formState.errors.invoice_email?.message} {...form.register("invoice_email")} />
        <Input label={t("businessForm.bookingBufferMinutes")} type="number" error={form.formState.errors.booking_buffer_minutes?.message} {...form.register("booking_buffer_minutes")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("businessForm.brandColor")} placeholder="#1D4ED8" {...form.register("brand_color")} />
        <Input label={t("businessForm.brandLogoUrl")} error={form.formState.errors.brand_logo_url?.message} {...form.register("brand_logo_url")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Textarea label={t("businessForm.cancellationPolicy")} rows={4} {...form.register("cancellation_policy")} />
        <Textarea label={t("businessForm.prepaymentPolicy")} rows={4} {...form.register("prepayment_policy")} />
      </div>
      <Button type="submit" isLoading={form.formState.isSubmitting}>{t("businessForm.save")}</Button>
    </form>
  );
}
