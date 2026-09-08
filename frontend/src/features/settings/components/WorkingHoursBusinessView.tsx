import { Building2 } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { useI18n } from "../../../lib/i18n";
import type { WorkingHours } from "../../../types";

type BusinessDay = {
  key: string;
  schedule: WorkingHours | null;
};

function compactTime(value: string) {
  return value.slice(0, 5);
}

export function WorkingHoursBusinessView({
  days,
  onEdit,
}: {
  days: BusinessDay[];
  onEdit: () => void;
}) {
  const { t } = useI18n();

  function scheduleText(schedule: WorkingHours | null) {
    if (!schedule) return t("workingHours.notConfigured");
    if (schedule.is_day_off) return t("workingHours.dayOff");
    return `${compactTime(schedule.start_time)}–${compactTime(schedule.end_time)}`;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-zani-border bg-surface-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-zani-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-brand-50 text-brand-700">
            <Building2 aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zani-ink">{t("workingHours.weekOverview")}</h2>
            <p className="text-xs font-medium text-zani-subtle">{t("workingHours.businessWeekHint")}</p>
          </div>
        </div>
        <Button data-focus-return-id="working-hours-business-trigger" type="button" variant="secondary" onClick={onEdit}>
          {t("workingHours.editWeek")}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-3 md:hidden">
        {days.map(({ key, schedule }) => (
          <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-zani-ink">{t(key)}</p>
              <p className="mt-0.5 text-xs font-medium text-zani-subtle">{scheduleText(schedule)}</p>
            </div>
            <Badge variant={schedule && !schedule.is_day_off ? "success" : "neutral"} size="sm">
              {t(schedule && !schedule.is_day_off ? "workingHours.workingDay" : schedule?.is_day_off ? "workingHours.dayOff" : "workingHours.notConfigured")}
            </Badge>
          </div>
        ))}
      </div>
      <div className="hidden min-h-0 flex-1 overflow-auto md:block">
        <table className="w-full min-w-[620px] text-left text-sm" aria-label={t("workingHours.businessWeekTableLabel")}>
          <thead className="sticky top-0 border-b border-zani-border bg-surface-muted text-xs font-semibold text-zani-subtle">
            <tr>
              <th className="px-4 py-2.5">{t("workingHours.day")}</th>
              <th className="px-4 py-2.5">{t("appointment.status")}</th>
              <th className="px-4 py-2.5">{t("workingHours.start")}</th>
              <th className="px-4 py-2.5">{t("workingHours.end")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zani-border">
            {days.map(({ key, schedule }) => (
              <tr key={key}>
                <td className="px-4 py-3 font-semibold text-zani-ink">{t(key)}</td>
                <td className="px-4 py-3">
                  <Badge variant={schedule && !schedule.is_day_off ? "success" : "neutral"} size="sm">
                    {t(schedule && !schedule.is_day_off ? "workingHours.workingDay" : schedule?.is_day_off ? "workingHours.dayOff" : "workingHours.notConfigured")}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-medium text-zani-subtle">{schedule && !schedule.is_day_off ? compactTime(schedule.start_time) : "—"}</td>
                <td className="px-4 py-3 font-medium text-zani-subtle">{schedule && !schedule.is_day_off ? compactTime(schedule.end_time) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
