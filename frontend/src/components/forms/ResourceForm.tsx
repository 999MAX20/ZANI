import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
      <Input label="Название" error={form.formState.errors.name?.message} {...form.register("name")} />
      <Select
        label="Тип"
        options={[
          { value: "staff", label: "Специалист" },
          { value: "room", label: "Кабинет" },
          { value: "hall", label: "Зал" },
          { value: "box", label: "Бокс" },
          { value: "equipment", label: "Оборудование" },
          { value: "other", label: "Другое" },
        ]}
        {...form.register("resource_type")}
      />
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...form.register("is_active")} />
        Активен
      </label>
      <Button type="submit" isLoading={form.formState.isSubmitting}>Сохранить</Button>
    </form>
  );
}
