import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Business } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const schema = z.object({
  name: z.string().min(2, "Введите название"),
  slug: z.string().min(2, "Введите slug"),
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

type Values = z.infer<typeof schema>;

export function BusinessSettingsForm({
  initial,
  onSubmit,
}: {
  initial?: Business | null;
  onSubmit: (payload: Partial<Business>) => Promise<unknown>;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
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
        <Input label="Название" error={form.formState.errors.name?.message} {...form.register("name")} />
        <Input label="Slug" error={form.formState.errors.slug?.message} {...form.register("slug")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Тип бизнеса" options={[
          { value: "dentistry", label: "Стоматология" },
          { value: "beauty", label: "Beauty" },
          { value: "sauna", label: "Сауна" },
          { value: "autoservice", label: "Автосервис" },
          { value: "education", label: "Образование" },
          { value: "medical", label: "Медицина" },
          { value: "other", label: "Другое" },
        ]} {...form.register("business_type")} />
        <Select label="Статус" options={[
          { value: "trial", label: "Пробный" },
          { value: "active", label: "Активен" },
          { value: "inactive", label: "Неактивен" },
          { value: "blocked", label: "Заблокирован" },
        ]} {...form.register("status")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Город" {...form.register("city")} />
        <Input label="Адрес" {...form.register("address")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Телефон" {...form.register("phone")} />
        <Input label="Timezone" {...form.register("timezone")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="WhatsApp" {...form.register("whatsapp")} />
        <Input label="Telegram" {...form.register("telegram")} />
        <Input label="Instagram" {...form.register("instagram")} />
      </div>
      <Button type="submit" isLoading={form.formState.isSubmitting}>Сохранить настройки</Button>
    </form>
  );
}
