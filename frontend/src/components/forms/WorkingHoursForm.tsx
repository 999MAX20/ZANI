import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { getApiErrorMessage } from "../../api/client";
import { useI18n } from "../../lib/i18n";
import type { Id, Resource, WorkingHours } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { ErrorState } from "../ui/StateViews";

const schema = z.object({
  resource: z.coerce.number().optional(),
  weekday: z.coerce.number().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  is_day_off: z.boolean(),
});

type Values = z.infer<typeof schema>;

const weekdays = [
  { value: 0, shortKey: "weekday.monShort", labelKey: "weekday.mon" },
  { value: 1, shortKey: "weekday.tueShort", labelKey: "weekday.tue" },
  { value: 2, shortKey: "weekday.wedShort", labelKey: "weekday.wed" },
  { value: 3, shortKey: "weekday.thuShort", labelKey: "weekday.thu" },
  { value: 4, shortKey: "weekday.friShort", labelKey: "weekday.fri" },
  { value: 5, shortKey: "weekday.satShort", labelKey: "weekday.sat" },
  { value: 6, shortKey: "weekday.sunShort", labelKey: "weekday.sun" },
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
        ...weekdays.map((day) => ({ value: day.value, label: t(day.labelKey) })),
      ]} {...form.register("weekday")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("workingHours.start")} type="time" {...form.register("start_time")} />
        <Input label={t("workingHours.end")} type="time" {...form.register("end_time")} />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-zani-subtle">
        <input type="checkbox" className="h-4 w-4 rounded border-zani-border accent-brand-500" {...form.register("is_day_off")} />
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
  formId,
  showSubmit = true,
  showContextHint = true,
  lockTarget = false,
  disabled = false,
  compact = false,
  layout = "rows",
  resetVersion = 0,
  onDirtyChange,
  onSubmit,
}: {
  businessId: Id;
  resources: Resource[];
  existingHours: WorkingHours[];
  initialResource?: Id | null;
  formId?: string;
  showSubmit?: boolean;
  showContextHint?: boolean;
  lockTarget?: boolean;
  disabled?: boolean;
  compact?: boolean;
  layout?: "rows" | "week-grid";
  resetVersion?: number;
  onDirtyChange?: (isDirty: boolean) => void;
  onSubmit: (payload: Array<Partial<WorkingHours>>) => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [resource, setResource] = useState<string>(initialResource ? String(initialResource) : "");
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const targetResource = resource ? Number(resource) : null;

  const buildWeek = (nextTarget: Id | null) =>
    weekdays.map((day) => {
      const existing = existingHours.find(
        (item) =>
          item.weekday === day.value &&
          (item.resource || null) === nextTarget,
      );
      return {
        weekday: day.value,
        start_time: existing?.start_time?.slice(0, 5) || "09:00",
        end_time: existing?.end_time?.slice(0, 5) || "18:00",
        is_day_off: existing?.is_day_off ?? day.value === 6,
      };
    });

  const [days, setDays] = useState<WeeklyDayValue[]>(() => buildWeek(targetResource));
  const [baseline, setBaseline] = useState<WeeklyDayValue[]>(() => buildWeek(targetResource));
  const isDirty = useMemo(
    () => JSON.stringify(days) !== JSON.stringify(baseline),
    [baseline, days],
  );

  useEffect(() => {
    const nextResource = initialResource ? String(initialResource) : "";
    const nextTarget = initialResource || null;
    const nextWeek = buildWeek(nextTarget);
    setResource(nextResource);
    setDays(nextWeek);
    setBaseline(nextWeek);
    setError("");
  // existingHours is intentionally read only when the selected target or reset request changes.
  // A background refetch must not erase an unsaved weekly draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialResource, resetVersion]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  function applyPreset(kind: "salon" | "weekdays" | "custom") {
    if (disabled) return;
    setDays((current) =>
      current.map((day) => {
        if (kind === "salon") return { ...day, start_time: "09:00", end_time: "20:00", is_day_off: false };
        if (kind === "weekdays") return { ...day, start_time: "09:00", end_time: "18:00", is_day_off: day.weekday > 4 };
        return day;
      }),
    );
  }

  function copyBusinessSchedule() {
    if (disabled) return;
    setError("");
    setDays(
      weekdays.map((day) => {
        const businessDay = existingHours.find((item) => item.weekday === day.value && !item.resource);
        return {
          weekday: day.value,
          start_time: businessDay?.start_time?.slice(0, 5) || "09:00",
          end_time: businessDay?.end_time?.slice(0, 5) || "18:00",
          is_day_off: businessDay?.is_day_off ?? day.value === 6,
        };
      }),
    );
  }

  function updateDay(weekday: number, patch: Partial<WeeklyDayValue>) {
    if (disabled) return;
    setError("");
    setDays((current) => current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)));
  }

  function hasInvalidWorkingTime() {
    return days.some((day) => !day.is_day_off && day.end_time <= day.start_time);
  }

  return (
    <form
      id={formId}
      data-testid="weekly-working-hours-form"
      className={compact ? "grid gap-4" : "grid gap-5"}
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled || isSubmitting) return;
        if (hasInvalidWorkingTime()) {
          setError(t("workingHours.invalidTime"));
          return;
        }
        setSubmitting(true);
        setError("");
        try {
          await onSubmit(days.map((day) => ({ ...day, business: businessId, resource: targetResource })));
          setBaseline(days);
        } catch (error) {
          setError(getApiErrorMessage(error));
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {showContextHint ? (
        <div className="rounded-card border border-brand-100 bg-brand-50 p-4 text-sm text-zani-subtle">
          <p className="font-semibold text-zani-ink">{t("workingHours.formTitle")}</p>
          <p className="mt-1 leading-6">{t("workingHours.formText")}</p>
        </div>
      ) : null}
      {!lockTarget ? (
        <Select
          label={t("workingHours.target")}
          value={resource}
          disabled={disabled}
          onChange={(event) => {
            const nextResource = event.target.value;
            const nextTarget = nextResource ? Number(nextResource) : null;
            const nextWeek = buildWeek(nextTarget);
            setResource(nextResource);
            setDays(nextWeek);
            setBaseline(nextWeek);
            setError("");
          }}
          options={[{ value: "", label: t("workingHours.wholeBusinessSchedule") }, ...resources.map((item) => ({ value: item.id, label: item.name }))]}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button data-testid="working-hours-preset-daily" type="button" variant="secondary" disabled={disabled} onClick={() => applyPreset("salon")}>{t("workingHours.salonPreset")}</Button>
        <Button data-testid="working-hours-preset-weekdays" type="button" variant="secondary" disabled={disabled} onClick={() => applyPreset("weekdays")}>{t("workingHours.officePreset")}</Button>
        {targetResource ? (
          <Button type="button" variant="secondary" disabled={disabled} onClick={copyBusinessSchedule}>{t("workingHours.copyBusinessSchedule")}</Button>
        ) : null}
      </div>
      {error ? <ErrorState message={error} /> : null}
      <div className={layout === "week-grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-7" : "grid gap-3"}>
        {weekdays.map((weekday) => {
          const day = days.find((item) => item.weekday === weekday.value)!;
          return (
            <div
              key={weekday.value}
              className={layout === "week-grid"
                ? "grid min-w-0 gap-2 rounded-card border border-zani-border bg-surface-card p-3 shadow-sm"
                : compact
                ? "grid grid-cols-2 gap-3 rounded-card border border-zani-border bg-surface-card p-3 shadow-sm"
                : "grid gap-3 rounded-card border border-zani-border bg-surface-card p-3 shadow-sm sm:grid-cols-[120px_1fr_1fr_140px] sm:items-center"}
            >
              <div className={layout === "week-grid"
                ? "flex items-center justify-between gap-2"
                : compact
                  ? "col-span-2 flex items-center justify-between gap-3"
                  : undefined}
              >
                <p className="font-semibold text-zani-ink">{t(weekday.labelKey)}</p>
                <p className="text-xs font-semibold text-zani-faint">{t(weekday.shortKey)}</p>
              </div>
              <Input
                label={t("workingHours.start")}
                type="time"
                value={day.start_time}
                disabled={disabled || day.is_day_off}
                onChange={(event) => updateDay(weekday.value, { start_time: event.target.value })}
              />
              <Input
                label={t("workingHours.end")}
                type="time"
                value={day.end_time}
                disabled={disabled || day.is_day_off}
                onChange={(event) => updateDay(weekday.value, { end_time: event.target.value })}
              />
              <label className={layout === "week-grid"
                ? "flex min-h-11 items-center gap-2 rounded-control bg-surface-muted px-2 text-xs font-semibold text-zani-subtle"
                : compact
                ? "col-span-2 flex min-h-11 items-center gap-3 rounded-control bg-surface-muted px-3 text-sm font-semibold text-zani-subtle"
                : "flex min-h-12 items-center gap-3 rounded-control bg-surface-muted px-3 text-sm font-semibold text-zani-subtle sm:pt-0"}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-zani-border accent-brand-500"
                  checked={day.is_day_off}
                  disabled={disabled}
                  onChange={(event) => updateDay(weekday.value, { is_day_off: event.target.checked })}
                />
                {t("workingHours.dayOff")}
              </label>
            </div>
          );
        })}
      </div>
      {showSubmit ? (
        <Button data-testid="working-hours-save-week" type="submit" disabled={disabled || !isDirty} isLoading={isSubmitting}>{t("workingHours.saveWeek")}</Button>
      ) : null}
    </form>
  );
}
