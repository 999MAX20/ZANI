import { CalendarCheck2, CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

import { ResourceForm } from "../../../components/forms/ResourceForm";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ErrorState, SkeletonBlock } from "../../../components/ui/StateViews";
import { StatusNotice } from "../../../components/ui/StatusNotice";
import { useI18n } from "../../../lib/i18n";
import type { Id, Resource, TeamMember, WorkingHours } from "../../../types";
import { ResourceStatusBadge } from "./ResourceStatusBadge";

const FORM_ID = "resource-edit-form";
const weekdayKeys = [
  "weekday.monShort",
  "weekday.tueShort",
  "weekday.wedShort",
  "weekday.thuShort",
  "weekday.friShort",
  "weekday.satShort",
  "weekday.sunShort",
];

function compactTime(value: string) {
  return value.slice(0, 5);
}

export function ResourceEditModal({
  resource,
  businessId,
  teamMembers,
  workingHours,
  scheduleLoading,
  scheduleError,
  canManage,
  isSaving,
  errorMessage,
  onSubmit,
  onClose,
  onDirtyChange,
  onOpenSchedule,
}: {
  resource: Resource | null;
  businessId: Id;
  teamMembers: TeamMember[];
  workingHours: WorkingHours[];
  scheduleLoading: boolean;
  scheduleError?: string;
  canManage: boolean;
  isSaving: boolean;
  errorMessage?: string;
  onSubmit: (payload: Partial<Resource>) => Promise<unknown>;
  onClose: () => void;
  onDirtyChange: (isDirty: boolean) => void;
  onOpenSchedule: () => void;
}) {
  const { t } = useI18n();
  const [resetVersion, setResetVersion] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setResetVersion(0);
    setIsDirty(false);
    onDirtyChange(false);
  }, [onDirtyChange, resource?.id]);

  if (!resource) return null;

  function handleDirtyChange(nextDirty: boolean) {
    setIsDirty(nextDirty);
    onDirtyChange(nextDirty);
  }

  function resetForm() {
    setResetVersion((current) => current + 1);
    handleDirtyChange(false);
  }

  const scheduleByDay = new Map(workingHours.map((item) => [item.weekday, item]));

  return (
    <Modal
      title={resource.name}
      open
      onClose={() => { if (!isSaving) onClose(); }}
      size="xl"
      closeOnBackdrop={!isSaving}
      testId="resource-edit-modal"
      bodyClassName="p-0"
    >
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ResourceStatusBadge resource={resource} size="sm" />
            <p className="text-sm text-zani-subtle">{t("resources.inspectorSubtitle")}</p>
          </div>
          {errorMessage ? <ErrorState message={errorMessage} /> : null}
          {!canManage ? (
            <StatusNotice tone="warning" title={t("resources.readOnlyTitle")} description={t("resources.readOnlyText")} />
          ) : null}
          <ResourceForm
            key={`${resource.id}:${resource.updated_at}:${resetVersion}`}
            formId={FORM_ID}
            businessId={businessId}
            initial={resource}
            teamMembers={teamMembers}
            disabled={!canManage}
            showContextHint={false}
            showSubmit={false}
            onDirtyChange={handleDirtyChange}
            onSubmit={onSubmit}
          />
        </div>

        <div className="space-y-4">
          <section className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-50 text-brand-700">
                <CalendarCheck2 aria-hidden="true" size={19} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zani-ink">{t("resources.usageTitle")}</h3>
                <p className="mt-1 text-sm leading-5 text-zani-subtle">
                  {t("resources.usageText", { count: resource.appointment_count || 0 })}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-50 text-brand-700">
                <CalendarClock aria-hidden="true" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-zani-ink">{t("resources.scheduleTitle")}</h3>
                {scheduleLoading ? (
                  <div className="mt-3 space-y-2" aria-busy="true">
                    <SkeletonBlock className="h-8" />
                    <SkeletonBlock className="h-8" />
                  </div>
                ) : scheduleError ? (
                  <div className="mt-3"><ErrorState message={scheduleError} /></div>
                ) : workingHours.length ? (
                  <div className="mt-3 grid grid-cols-7 overflow-hidden rounded-control border border-zani-border">
                    {weekdayKeys.map((key, weekday) => {
                      const schedule = scheduleByDay.get(weekday);
                      return (
                        <div key={key} className="min-w-0 border-r border-zani-border px-1.5 py-2 text-center last:border-r-0">
                          <p className="text-[10px] font-semibold text-zani-faint">{t(key)}</p>
                          <p className="mt-1 text-[10px] font-semibold leading-3 text-zani-text">
                            {!schedule || schedule.is_day_off ? t("workingHours.dayOff") : (
                              <><span className="block">{compactTime(schedule.start_time)}</span><span className="block">{compactTime(schedule.end_time)}</span></>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-5 text-zani-subtle">{t("workingHours.usesBusinessSchedule")}</p>
                )}
                <button
                  type="button"
                  onClick={onOpenSchedule}
                  className="zani-focus-ring mt-3 inline-flex rounded-control text-sm font-semibold text-brand-700 hover:text-brand-800"
                >
                  {t("resources.openSchedule")}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zani-border bg-surface-card px-4 py-3 sm:px-5">
        {canManage ? (
          <>
            <Button type="button" variant="secondary" disabled={!isDirty || isSaving} onClick={resetForm}>{t("common.cancel")}</Button>
            <Button type="submit" form={FORM_ID} disabled={!isDirty} isLoading={isSaving}>{t("resources.save")}</Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={onClose}>{t("common.close")}</Button>
        )}
      </div>
    </Modal>
  );
}
