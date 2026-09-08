import { useEffect, useState } from "react";

import { WeeklyWorkingHoursForm } from "../../../components/forms/WorkingHoursForm";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ErrorState } from "../../../components/ui/StateViews";
import { StatusNotice } from "../../../components/ui/StatusNotice";
import { useI18n } from "../../../lib/i18n";
import type { Business, Resource, WorkingHours } from "../../../types";

const FORM_ID = "working-hours-edit-form";

export function WorkingHoursEditModal({
  business,
  resource,
  resources,
  existingHours,
  open,
  canManage,
  isSaving,
  errorMessage,
  onSubmit,
  onClose,
  onDirtyChange,
}: {
  business: Business;
  resource: Resource | null;
  resources: Resource[];
  existingHours: WorkingHours[];
  open: boolean;
  canManage: boolean;
  isSaving: boolean;
  errorMessage?: string;
  onSubmit: (payloads: Array<Partial<WorkingHours>>) => Promise<unknown>;
  onClose: () => void;
  onDirtyChange: (isDirty: boolean) => void;
}) {
  const { t } = useI18n();
  const [resetVersion, setResetVersion] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const targetKey = resource ? `resource:${resource.id}` : "business";

  useEffect(() => {
    setResetVersion(0);
    setIsDirty(false);
    onDirtyChange(false);
  }, [onDirtyChange, open, targetKey]);

  function handleDirtyChange(nextDirty: boolean) {
    setIsDirty(nextDirty);
    onDirtyChange(nextDirty);
  }

  function resetForm() {
    setResetVersion((current) => current + 1);
    handleDirtyChange(false);
  }

  return (
    <Modal
      title={resource?.name || business.name}
      open={open}
      onClose={() => { if (!isSaving) onClose(); }}
      size="xl"
      closeOnBackdrop={!isSaving}
      testId="working-hours-edit-modal"
      bodyClassName="p-0"
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={resource ? "info" : "neutral"} size="sm">
            {t(resource ? "workingHours.individualSchedule" : "workingHours.businessSchedule")}
          </Badge>
          <p className="text-sm text-zani-subtle">
            {t(resource ? "workingHours.resourceInspectorSubtitle" : "workingHours.businessInspectorSubtitle")}
          </p>
        </div>
        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        {!canManage ? (
          <StatusNotice tone="warning" title={t("workingHours.readOnlyTitle")} description={t("workingHours.readOnlyText")} />
        ) : null}
        <WeeklyWorkingHoursForm
          key={`${targetKey}:${resetVersion}`}
          formId={FORM_ID}
          businessId={business.id}
          resources={resources}
          existingHours={existingHours}
          initialResource={resource?.id || null}
          showSubmit={false}
          showContextHint={false}
          lockTarget
          layout="week-grid"
          disabled={!canManage}
          resetVersion={resetVersion}
          onDirtyChange={handleDirtyChange}
          onSubmit={onSubmit}
        />
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zani-border bg-surface-card px-4 py-3 sm:px-5">
        {canManage ? (
          <>
            <Button type="button" variant="secondary" disabled={!isDirty || isSaving} onClick={resetForm}>{t("common.cancel")}</Button>
            <Button data-testid="working-hours-save-week" type="submit" form={FORM_ID} disabled={!isDirty} isLoading={isSaving}>{t("workingHours.saveWeek")}</Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={onClose}>{t("common.close")}</Button>
        )}
      </div>
    </Modal>
  );
}
