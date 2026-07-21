import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";
import { CalendarPicker } from "./CalendarPicker";
import { CalendarResourceFilters } from "./CalendarFilters";
import type { CalendarTranslate, CalendarViewMode, SearchableCalendarFilterOption } from "../calendarTypes";

export function CalendarToolbar({
  date,
  viewMode,
  locale,
  todayValue,
  weekDays,
  serviceFilter,
  resourceFilter,
  statusFilter,
  serviceOptions,
  resourceOptions,
  isServicesLoading,
  isResourcesLoading,
  onDateChange,
  onViewModeChange,
  onShiftDate,
  onServiceChange,
  onResourceChange,
  onStatusChange,
  t,
}: {
  date: string;
  viewMode: CalendarViewMode;
  locale: string;
  todayValue: string;
  weekDays: string[];
  serviceFilter: string;
  resourceFilter: string;
  statusFilter: string;
  serviceOptions: SearchableCalendarFilterOption[];
  resourceOptions: SearchableCalendarFilterOption[];
  isServicesLoading: boolean;
  isResourcesLoading: boolean;
  onDateChange: (value: string) => void;
  onViewModeChange: (value: CalendarViewMode) => void;
  onShiftDate: (days: number) => void;
  onServiceChange: (value: string) => void;
  onResourceChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  t: CalendarTranslate;
}) {
  const filterControls = (
    <CalendarResourceFilters
      serviceFilter={serviceFilter}
      resourceFilter={resourceFilter}
      statusFilter={statusFilter}
      serviceOptions={serviceOptions}
      resourceOptions={resourceOptions}
      isServicesLoading={isServicesLoading}
      isResourcesLoading={isResourcesLoading}
      onServiceChange={onServiceChange}
      onResourceChange={onResourceChange}
      onStatusChange={onStatusChange}
      t={t}
    />
  );

  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="icon" className="h-10 w-10" onClick={() => onShiftDate(-1)} aria-label={t("calendar.previousDay")}>
            <ChevronLeft size={18} />
          </Button>
          <CalendarPicker
            value={date}
            onChange={onDateChange}
            locale={locale}
            todayValue={todayValue}
            labels={{
              previousMonth: t("calendar.previousMonth"),
              nextMonth: t("calendar.nextMonth"),
              today: t("calendar.today"),
              weekdays: weekDays,
            }}
          />
          <Button variant="secondary" size="icon" className="h-10 w-10" onClick={() => onShiftDate(1)} aria-label={t("calendar.nextDay")}>
            <ChevronRight size={18} />
          </Button>
          <Button variant="secondary" className="h-10 px-3" onClick={() => onDateChange(todayValue)}>
            {t("calendar.today")}
          </Button>
          <div className="grid grid-cols-4 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {[
              { value: "day", label: t("calendar.day") },
              { value: "week", label: t("calendar.week") },
              { value: "month", label: t("calendar.month") },
              { value: "list", label: t("appointments.title") },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  "rounded-md px-3 py-2 text-xs font-black transition sm:text-sm",
                  viewMode === item.value ? "bg-midnight text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-midnight",
                )}
                onClick={() => onViewModeChange(item.value as CalendarViewMode)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-3 lg:hidden">
        <summary className="cursor-pointer list-none text-sm font-black text-midnight">
          <span className="inline-flex items-center gap-2"><Filter size={18} />{t("calendar.filters")}</span>
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">{filterControls}</div>
      </details>
      <div className="mt-3 hidden items-center gap-2 border-t border-slate-200 pt-3 lg:grid lg:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1fr)_170px]">{filterControls}</div>
    </section>
  );
}
