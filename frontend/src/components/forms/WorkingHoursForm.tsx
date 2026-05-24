import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useI18n } from "../../lib/i18n";
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

const weekdays = [
  { value: 0, short: "Пн", label: "Понедельник" },
  { value: 1, short: "Вт", label: "Вторник" },
  { value: 2, short: "Ср", label: "Среда" },
  { value: 3, short: "Чт", label: "Четверг" },
  { value: 4, short: "Пт", label: "Пятница" },
  { value: 5, short: "Сб", label: "Суббота" },
  { value: 6, short: "Вс", label: "Воскресенье" },
];

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
  const { t } = useI18n();
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
      <Select label={t("workingHours.resource")} options={[{ value: "", label: t("workingHours.wholeBusinessSchedule") }, ...resources.map((resource) => ({ value: resource.id, label: resource.name }))]} {...form.register("resource")} />
      <Select label={t("workingHours.weekday")} options={[
        ...weekdays.map((day) => ({ value: day.value, label: day.label })),
      ]} {...form.register("weekday")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("workingHours.start")} type="time" {...form.register("start_time")} />
        <Input label={t("workingHours.end")} type="time" {...form.register("end_time")} />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...form.register("is_day_off")} />
        {t("workingHours.dayOff")}
      </label>
      <Button type="submit" isLoading={form.formState.isSubmitting}>{t("workingHours.saveSchedule")}</Button>
    </form>
  );
}

type WeeklyDayValue = {
  weekday: number;
  start_time: string;
  end_time: string;
  is_day_off: boolean;
};

export function WeeklyWorkingHoursForm({
  businessId,
  resources,
  existingHours,
  initialResource,
  onSubmit,
}: {
  businessId: Id;
  resources: Resource[];
  existingHours: WorkingHours[];
  initialResource?: Id | null;
  onSubmit: (payload: Array<Partial<WorkingHours>>) => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [resource, setResource] = useState<string>(initialResource ? String(initialResource) : "");
  const [isSubmitting, setSubmitting] = useState(false);
  const targetResource = resource ? Number(resource) : null;
  const currentHours = useMemo(
    () =>
      weekdays.map((day) => {
        const existing = existingHours.find((item) => item.weekday === day.value && (item.resource || null) === targetResource);
        return {
          weekday: day.value,
          start_time: existing?.start_time?.slice(0, 5) || "09:00",
          end_time: existing?.end_time?.slice(0, 5) || "18:00",
          is_day_off: existing?.is_day_off ?? day.value === 6,
        };
      }),
    [existingHours, targetResource],
  );
  const [days, setDays] = useState<WeeklyDayValue[]>(currentHours);

  function applyPreset(kind: "salon" | "weekdays" | "custom") {
    setDays((current) =>
      current.map((day) => {
        if (kind === "salon") return { ...day, start_time: "09:00", end_time: "20:00", is_day_off: false };
        if (kind === "weekdays") return { ...day, start_time: "09:00", end_time: "18:00", is_day_off: day.weekday > 4 };
        return day;
      }),
    );
  }

  function updateDay(weekday: number, patch: Partial<WeeklyDayValue>) {
    setDays((current) => current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)));
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
          await onSubmit(days.map((day) => ({ ...day, business: businessId, resource: targetResource })));
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="rounded-3xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-slate-700">
        <p className="font-bold text-midnight">{t("workingHours.formTitle")}</p>
        <p className="mt-1 leading-6">
          {t("workingHours.formText")}
        </p>
      </div>
      <Select
        label={t("workingHours.target")}
        value={resource}
        onChange={(event) => {
          const nextResource = event.target.value;
          setResource(nextResource);
          const nextTarget = nextResource ? Number(nextResource) : null;
          setDays(
            weekdays.map((day) => {
              const existing = existingHours.find((item) => item.weekday === day.value && (item.resource || null) === nextTarget);
              return {
                weekday: day.value,
                start_time: existing?.start_time?.slice(0, 5) || "09:00",
                end_time: existing?.end_time?.slice(0, 5) || "18:00",
                is_day_off: existing?.is_day_off ?? day.value === 6,
              };
            }),
          );
        }}
        options={[{ value: "", label: t("workingHours.wholeBusinessSchedule") }, ...resources.map((item) => ({ value: item.id, label: item.name }))]}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => applyPreset("salon")}>{t("workingHours.salonPreset")}</Button>
        <Button type="button" variant="secondary" onClick={() => applyPreset("weekdays")}>{t("workingHours.officePreset")}</Button>
      </div>
      <div className="grid gap-3">
        {weekdays.map((weekday) => {
          const day = days.find((item) => item.weekday === weekday.value)!;
          return (
            <div key={weekday.value} className="grid gap-3 rounded-3xl border border-slate-100 bg-white/80 p-3 sm:grid-cols-[120px_1fr_1fr_120px] sm:items-center">
              <div>
                <p className="font-bold text-midnight">{weekday.label}</p>
                <p className="text-xs text-slate-400">{weekday.short}</p>
              </div>
              <Input
                label={t("workingHours.start")}
                type="time"
                value={day.start_time}
                disabled={day.is_day_off}
                onChange={(event) => updateDay(weekday.value, { start_time: event.target.value })}
              />
              <Input
                label={t("workingHours.end")}
                type="time"
                value={day.end_time}
                disabled={day.is_day_off}
                onChange={(event) => updateDay(weekday.value, { end_time: event.target.value })}
              />
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 sm:pt-7">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={day.is_day_off}
                  onChange={(event) => updateDay(weekday.value, { is_day_off: event.target.checked })}
                />
                {t("workingHours.dayOff")}
              </label>
            </div>
          );
        })}
      </div>
      <Button type="submit" isLoading={isSubmitting}>{t("workingHours.saveWeek")}</Button>
    </form>
  );
}
