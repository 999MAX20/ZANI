import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";
import { formatPickerDate, getMonthDates, parseDate, toDateInputValue } from "../calendarUtils";

export function CalendarPicker({
  value,
  onChange,
  labels,
  locale,
  todayValue,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  todayValue: string;
  labels: {
    previousMonth: string;
    nextMonth: string;
    today: string;
    weekdays: string[];
  };
}) {
  const [open, setOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(() => parseDate(value));
  const selected = parseDate(value);
  const cells = getMonthDates(toDateInputValue(monthDate));

  function shiftMonth(delta: number) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div className="relative w-full sm:w-auto">
      <Button
        variant="secondary"
        className="h-11 w-full justify-between rounded-2xl px-4 sm:min-w-[210px]"
        onClick={() => {
          setMonthDate(parseDate(value));
          setOpen((current) => !current);
        }}
      >
        <span className="truncate">{formatPickerDate(value, locale)}</span>
        <CalendarDays size={18} />
      </Button>
      {open ? (
        <div className="fixed inset-x-3 top-24 z-30 rounded-card border border-zani-border bg-zani-card p-4 shadow-premium sm:absolute sm:inset-auto sm:left-0 sm:top-14 sm:w-[340px]">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" className="h-12 w-12 rounded-full px-0" onClick={() => shiftMonth(-1)} aria-label={labels.previousMonth}>
              <ChevronLeft size={22} />
            </Button>
            <p className="font-semibold text-zani-text">
              {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(monthDate)}
            </p>
            <Button variant="ghost" className="h-12 w-12 rounded-full px-0" onClick={() => shiftMonth(1)} aria-label={labels.nextMonth}>
              <ChevronRight size={22} />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-zani-muted">
            {labels.weekdays.map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              const isSelected = cell && toDateInputValue(cell) === toDateInputValue(selected);
              const isToday = cell && toDateInputValue(cell) === todayValue;
              return (
                <button
                  key={cell ? toDateInputValue(cell) : `empty-${index}`}
                  type="button"
                  disabled={!cell}
                  onClick={() => {
                    if (!cell) return;
                    onChange(toDateInputValue(cell));
                    setOpen(false);
                  }}
                  className={cn(
                    "h-11 rounded-control text-sm font-bold transition disabled:pointer-events-none disabled:opacity-0",
                    isSelected
                      ? "bg-brand-600 text-white shadow-card"
                      : isToday
                        ? "bg-brand-50 text-brand-700"
                        : "text-zani-text hover:bg-surface-hover",
                  )}
                >
                  {cell?.getDate()}
                </button>
              );
            })}
          </div>
          <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => { onChange(todayValue); setOpen(false); }}>
            {labels.today}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
