import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { Button } from "../ui/Button";
import { Dialog } from "../ui/Overlay";
import { Textarea } from "../ui/Textarea";
import { useI18n } from "../../lib/i18n";

type ActionConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  reason?: {
    label: string;
    placeholder?: string;
    required?: boolean;
    minLength?: number;
  };
};

type ActionConfirmResult = {
  confirmed: boolean;
  reason?: string;
};

type PendingConfirm = ActionConfirmOptions & {
  resolve: (result: ActionConfirmResult) => void;
};

const ActionConfirmContext = createContext<((options: ActionConfirmOptions) => Promise<ActionConfirmResult>) | null>(null);

export function ActionConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [reason, setReason] = useState("");

  const confirm = useCallback((options: ActionConfirmOptions) => {
    setReason("");
    return new Promise<ActionConfirmResult>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (result: ActionConfirmResult) => {
      pending?.resolve(result);
      setPending(null);
      setReason("");
    },
    [pending],
  );

  const value = useMemo(() => confirm, [confirm]);
  const trimmedReason = reason.trim();
  const minLength = pending?.reason?.minLength ?? 3;
  const isReasonInvalid = Boolean(pending?.reason?.required && trimmedReason.length < minLength);

  return (
    <ActionConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <Dialog title={pending.title} open={Boolean(pending)} onClose={() => close({ confirmed: false })} size="sm" bodyClassName="space-y-4">
          {pending.description ? <p className="text-sm leading-6 text-zani-subtle">{pending.description}</p> : null}
          {pending.reason ? (
            <Textarea
              label={pending.reason.label}
              placeholder={pending.reason.placeholder}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              autoFocus
            />
          ) : null}
          {isReasonInvalid ? <p className="text-xs font-semibold text-zani-danger">{t("actions.reasonRequired", { count: minLength })}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => close({ confirmed: false })}>
              {pending.cancelLabel || t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant={pending.variant === "danger" ? "danger" : "primary"}
              disabled={isReasonInvalid}
              onClick={() => close({ confirmed: true, reason: trimmedReason })}
            >
              {pending.confirmLabel || t("actions.confirm")}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </ActionConfirmContext.Provider>
  );
}

export function useActionConfirm() {
  const context = useContext(ActionConfirmContext);
  if (!context) {
    throw new Error("useActionConfirm must be used within ActionConfirmProvider");
  }
  return context;
}
