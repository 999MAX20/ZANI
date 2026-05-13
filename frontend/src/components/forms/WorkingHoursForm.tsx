import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Id, Resource, WorkingHours } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const schema = z.object({
  resource: z.coerce.number().optional(),
  weekday: z.coerce.number().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  is_day_off: z.boolean(),
});

type Values = z.infer<typeof schema>;

export function WorkingHoursForm({
  businessId,
  resources,
  initial,
  onSubmit,
}: {
  businessId: Id;
  resources: Resource[];
  initial?: WorkingHours;
  onSubmit: (payload: Partial<WorkingHours>) => Promise<unknown>;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      resource: initial?.resource || undefined,
      weekday: initial?.weekday || 0,
      start_time: initial?.start_time || "09:00",
      end_time: initial?.end_time || "18:00",
      is_day_off: initial?.is_day_off || false,
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit({ ...values, business: businessId, resource: values.resource || null }))}>
      <Select label="Ресурс" options={[{ value: "", label: "Общий график бизнеса" }, ...resources.map((resource) => ({ value: resource.id, label: resource.name }))]} {...form.register("resource")} />
      <Select label="День недели" options={[
        { value: 0, label: "Понедельник" },
        { value: 1, label: "Вторник" },
        { value: 2, label: "Среда" },
        { value: 3, label: "Четверг" },
        { value: 4, label: "Пятница" },
        { value: 5, label: "Суббота" },
        { value: 6, label: "Воскресенье" },
      ]} {...form.register("weekday")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Начало" type="time" {...form.register("start_time")} />
        <Input label="Конец" type="time" {...form.register("end_time")} />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...form.register("is_day_off")} />
        Выходной
      </label>
      <Button type="submit" isLoading={form.formState.isSubmitting}>Сохранить график</Button>
    </form>
  );
}
