import { useMemo, useState } from "react";

import type { CrmCardActionDetail } from "../../types";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Textarea } from "../ui/Textarea";

type CrmActionBarProps = {
  actions: CrmCardActionDetail[];
  onExecute: (action: CrmCardActionDetail, reason?: string) => void;
  isPending?: boolean;
  className?: string;
  maxVisible?: number;
};

function actionLabel(action: CrmCardActionDetail, t: (key: string) => string) {
  const translated = t(action.label_key);
  return translated === action.label_key ? action.id.replace(/_/g, " ") : translated;
}

function scopeLabel(action: CrmCardActionDetail, t: (key: string) => string) {
  const key = `permissions.scope.${action.scope}`;
  const translated = t(key);
  return translated === key ? action.scope : translated;
}

export function CrmActionBar({ actions, onExecute, isPending = false, className, maxVisible = 8 }: CrmActionBarProps) {
  const { t } = useI18n();
  const [confirmAction, setConfirmAction] = useState<CrmCardActionDetail | null>(null);
  const [reasonAction, setReasonAction] = useState<CrmCardActionDetail | null>(null);
  const [reason, setReason] = useState("");
  const visibleActions = useMemo(() => actions.slice(0, maxVisible), [actions, maxVisible]);

  if (!visibleActions.length) return null;

  function requestExecute(action: CrmCardActionDetail) {
    if (!action.allowed) return;
    if (action.confirmation === "reason" || action.requires_reason) {
      setReasonAction(action);
      setReason("");
      return;
    }
    if (action.confirmation === "confirm" || action.destructive) {
      setConfirmAction(action);
      return;
    }
    onExecute(action);
  }

  function closeReason() {
    setReasonAction(null);
    setReason("");
  }

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {visibleActions.map((action) => {
          const destructive = action.destructive || action.confirmation === "reason";
          return (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={destructive ? "danger" : action.confirmation === "confirm" ? "secondary" : "secondary"}
              disabled={!action.allowed || isPending}
              isLoading={isPending && action.allowed}
              data-crm-action-id={action.id}
              title={!action.allowed && action.reason ? action.reason : scopeLabel(action, t)}
              onClick={() => requestExecute(action)}
            >
              {actionLabel(action, t)}
            </Button>
          );
        })}
      </div>

      <Modal title={confirmAction ? actionLabel(confirmAction, t) : ""} open={Boolean(confirmAction)} onClose={() => setConfirmAction(null)}>
        {confirmAction ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold leading-6 text-zani-subtle">{scopeLabel(confirmAction, t)}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmAction(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant={confirmAction.destructive ? "danger" : "primary"}
                isLoading={isPending}
                onClick={() => {
                  onExecute(confirmAction);
                  setConfirmAction(null);
                }}
              >
                {t("actions.confirm")}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title={reasonAction ? actionLabel(reasonAction, t) : ""} open={Boolean(reasonAction)} onClose={closeReason}>
        {reasonAction ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!reason.trim()) return;
              onExecute(reasonAction, reason.trim());
              closeReason();
            }}
          >
            <Textarea label={t("leads.lostReasonRequired")} value={reason} onChange={(event) => setReason(event.target.value)} required />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeReason}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="danger" isLoading={isPending} disabled={!reason.trim()}>
                {t("actions.confirm")}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
