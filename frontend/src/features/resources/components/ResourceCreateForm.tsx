import { useState } from "react";

import { ResourceForm } from "../../../components/forms/ResourceForm";
import { WeeklyWorkingHoursForm } from "../../../components/forms/WorkingHoursForm";
import { Button } from "../../../components/ui/Button";
import { useI18n } from "../../../lib/i18n";
import type { Id, Resource, TeamMember, WorkingHours } from "../../../types";

export function ResourceCreateForm({ businessId, initial, teamMembers, businessHours, disabled, onSubmit }: {
  businessId: Id;
  initial?: Partial<Resource>;
  teamMembers: TeamMember[];
  businessHours: WorkingHours[];
  disabled: boolean;
  onSubmit: (payload: Partial<Resource>) => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Partial<Resource> | null>(null);
  const [scheduleStep, setScheduleStep] = useState(false);
  if (!scheduleStep || !draft) return (
    <ResourceForm businessId={businessId} initial={draft || initial} teamMembers={teamMembers}
      disabled={disabled} showContextHint={false} submitLabel={t("resources.setupSchedule")}
      onSubmit={async (payload) => { setDraft(payload); setScheduleStep(true); }} />
  );
  return (
    <div className="space-y-4" data-testid="resource-create-schedule">
      <h3 className="font-semibold text-zani-ink">{draft.name} · {t("workingHours.individualSchedule")}</h3>
      <WeeklyWorkingHoursForm businessId={businessId} resources={[]} existingHours={businessHours.filter((row) => !row.resource)}
        lockTarget showContextHint={false} disabled={disabled}
        onSubmit={(days) => onSubmit({ ...draft, weekly_schedule: days.map((day) => ({
          weekday: day.weekday!, start_time: day.start_time!, end_time: day.end_time!, is_day_off: Boolean(day.is_day_off),
        })) })} />
      <Button variant="secondary" type="button" onClick={() => setScheduleStep(false)}>{t("common.back")}</Button>
    </div>
  );
}
