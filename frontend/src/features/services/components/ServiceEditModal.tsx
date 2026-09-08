import { CalendarCheck2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ServiceForm } from "../../../components/forms/ServiceForm";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ErrorState } from "../../../components/ui/StateViews";
import { StatusNotice } from "../../../components/ui/StatusNotice";
import { useI18n } from "../../../lib/i18n";
import type { Id, Service } from "../../../types";
import { ServiceStatusBadge } from "./ServiceStatusBadge";

const FORM_ID = "service-edit-form";

export function ServiceEditModal({
  service,
  businessId,
  appointmentCount,
  canManage,
  isSaving,
  errorMessage,
  onSubmit,
  onClose,
  onDirtyChange,
}: {
  service: Service | null;
  businessId: Id;
  appointmentCount: number;
  canManage: boolean;
  isSaving: boolean;
  errorMessage?: string;
  onSubmit: (payload: Partial<Service>) => Promise<unknown>;
  onClose: () => void;
  onDirtyChange: (isDirty: boolean) => void;
}) {
  const { t } = useI18n();
  const [resetVersion, setResetVersion] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setResetVersion(0);
    setIsDirty(false);
    onDirtyChange(false);
  }, [onDirtyChange, service?.id]);

  if (!service) return null;

  const canEdit = canManage && !service.is_archived;

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
      title={service.name}
      open
      onClose={() => { if (!isSaving) onClose(); }}
      size="lg"
      closeOnBackdrop={!isSaving}
      testId="service-edit-modal"
      bodyClassName="p-0"
    >
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ServiceStatusBadge service={service} size="sm" />
            <p className="text-sm text-zani-subtle">{t("services.inspectorSubtitle")}</p>
          </div>
          {errorMessage ? <ErrorState message={errorMessage} /> : null}
          {!canEdit ? (
            <StatusNotice
              tone="warning"
              title={t(service.is_archived ? "services.archivedReadOnlyTitle" : "services.readOnlyTitle")}
              description={t(service.is_archived ? "services.archivedReadOnlyText" : "services.readOnlyText")}
            />
          ) : null}
          <ServiceForm
            key={`${service.id}:${service.updated_at}:${resetVersion}`}
            formId={FORM_ID}
            businessId={businessId}
            initial={service}
            disabled={!canEdit}
            showContextHint={false}
            showSubmit={false}
            onDirtyChange={handleDirtyChange}
            onSubmit={onSubmit}
          />
        </div>

        <aside className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm lg:self-start">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-50 text-brand-700">
              <CalendarCheck2 aria-hidden="true" size={19} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zani-ink">{t("services.usageTitle")}</h3>
              <p className="mt-1 text-sm leading-5 text-zani-subtle">
                {t("services.usageText", { count: appointmentCount })}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zani-border bg-surface-card px-4 py-3 sm:px-5">
        {canEdit ? (
          <>
            <Button type="button" variant="secondary" disabled={!isDirty || isSaving} onClick={resetForm}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form={FORM_ID} disabled={!isDirty} isLoading={isSaving}>
              {t("services.save")}
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={onClose}>{t("common.close")}</Button>
        )}
      </div>
    </Modal>
  );
}
