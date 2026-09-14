import { useEffect, useRef } from "react";
import { useBlocker } from "react-router";

import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import { useI18n } from "../../lib/i18n";

export function usePaymentDraftGuard(dirty: boolean, pending: boolean, uncertain: boolean) {
  const { t } = useI18n();
  const confirm = useActionConfirm();
  const blocker = useBlocker(dirty || pending || uncertain);
  const confirming = useRef(false);
  useEffect(() => {
    if (!dirty && !pending && !uncertain) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, pending, uncertain]);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (pending) { blocker.reset(); return; }
    if (confirming.current) return;
    confirming.current = true;
    void confirm({ title: t("payments.discardTitle"), description: t(uncertain ? "payments.uncertainClose" : "payments.discardText"), confirmLabel: t("payments.discard"), tone: "warning" })
      .then(({ confirmed }) => {
        confirming.current = false;
        if (confirmed) blocker.proceed(); else blocker.reset();
      });
  }, [blocker, confirm, pending, t, uncertain]);
}
