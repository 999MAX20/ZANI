import axios from "axios";
import { useCallback, type RefObject } from "react";

import { useI18n } from "../../lib/i18n";
import { useNotification } from "../notifications/NotificationProvider";
import {
  canOfferActionRecovery,
  canUseActionFallback,
  classifyActionError,
  type ActionErrorKind,
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
  const element =
    resolveFocusTarget(target) ||
    (typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);
  if (!element) return;
  window.requestAnimationFrame(() => element.focus());
}

function getStatus(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

const errorMessageKeys: Record<ActionErrorKind, string> = {
  validation: "actions.errorValidation",
  unauthenticated: "actions.errorUnauthenticated",
  forbidden: "actions.errorForbidden",
  unavailable: "actions.errorUnavailable",
  conflict: "actions.errorConflict",
  rateLimited: "actions.errorRateLimited",
  temporary: "actions.errorTemporary",
  network: "actions.errorNetwork",
  generic: "actions.errorGeneric",
};

export function useActionFeedback() {
  const { t } = useI18n();
  const showNotification = useNotification();

  const getRecoverableMessage = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      const status = getStatus(error);
      const transportError = axios.isAxiosError(error);
      const kind = classifyActionError(
        status,
        transportError && !error.response,
      );
      if (
        canUseActionFallback(kind, transportError, Boolean(fallbackMessage))
      ) {
        return fallbackMessage!;
      }
      return t(errorMessageKeys[kind]);
    },
    [t],
  );

  const notifyError = useCallback(
    (error: unknown, options: RecoveryOptions = {}) => {
      const status = getStatus(error);
      const retry = canOfferActionRecovery(status, Boolean(options.retry))
        ? options.retry
        : undefined;
      showNotification({
        message: getRecoverableMessage(error, options.fallbackMessage),
        tone: options.tone || (status === 403 || status === 404 ? "warning" : "danger"),
        durationMs: retry ? 10_000 : 7_000,
        actionLabel: retry ? options.actionLabel || t("common.retry") : undefined,
        onAction: retry,
      });
      restoreFocus(options.focusTarget);
    },
    [getRecoverableMessage, showNotification, t],
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
