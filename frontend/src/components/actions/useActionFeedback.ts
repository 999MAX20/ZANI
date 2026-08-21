import { useCallback, type RefObject } from "react";

import { normalizeAppError } from "../../api/appError";
import { useI18n } from "../../lib/i18n";
import { useNotification } from "../notifications/NotificationProvider";
import {
  canOfferActionRecovery,
  canUseActionFallback,
} from "./actionFeedbackPolicy";

type ActionFeedbackTone = "success" | "info" | "warning" | "danger";

type FocusTarget = HTMLElement | RefObject<HTMLElement | null> | null | undefined;

type RecoveryOptions = {
  actionLabel?: string;
  fallbackMessage?: string;
  focusTarget?: FocusTarget;
  retry?: () => Promise<void> | void;
  tone?: ActionFeedbackTone;
};

function resolveFocusTarget(target: FocusTarget) {
  if (!target) return null;
  if ("current" in target) return target.current;
  return target;
}

function restoreFocus(target: FocusTarget) {
  const activeElement =
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const focus = () => {
    const element = resolveFocusTarget(target) || activeElement;
    if (!element?.isConnected) return;
    element.focus({ preventScroll: true });
  };

  // Restore immediately for the common case, then repeat after React has
  // committed the notification and mutation state updates. The second frame
  // protects inputs whose adjacent submit button is re-enabled after an
  // asynchronous failure without stealing focus for a noticeable duration.
  focus();
  window.requestAnimationFrame(() => {
    focus();
    window.requestAnimationFrame(focus);
  });
}

export function useActionFeedback() {
  const { t } = useI18n();
  const showNotification = useNotification();

  const getRecoverableMessage = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      const appError = normalizeAppError(error);
      if (canUseActionFallback(appError, Boolean(fallbackMessage))) {
        return fallbackMessage!;
      }
      return t(appError.messageKey);
    },
    [t],
  );

  const notifyError = useCallback(
    (error: unknown, options: RecoveryOptions = {}) => {
      const appError = normalizeAppError(error);
      const retry = canOfferActionRecovery(appError, Boolean(options.retry))
        ? options.retry
        : undefined;
      const fallbackMessage = canUseActionFallback(appError, Boolean(options.fallbackMessage))
        ? options.fallbackMessage
        : undefined;
      showNotification({
        ...(fallbackMessage ? { message: fallbackMessage } : { appError }),
        tone: options.tone || (["permission", "not_found"].includes(appError.category) ? "warning" : "danger"),
        durationMs: retry ? 10_000 : 7_000,
        actionLabel: retry ? options.actionLabel || t("common.retry") : undefined,
        onAction: retry,
      });
      restoreFocus(options.focusTarget);
    },
    [showNotification, t],
  );

  const notifySuccess = useCallback(
    (message: string, options: { focusTarget?: FocusTarget } = {}) => {
      showNotification({ message, tone: "success" });
      restoreFocus(options.focusTarget);
    },
    [showNotification],
  );

  return {
    getRecoverableMessage,
    notifyError,
    notifySuccess,
  };
}
