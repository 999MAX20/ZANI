import axios from "axios";
import { useCallback, type RefObject } from "react";

import { getApiErrorMessage } from "../../api/client";
import { useI18n } from "../../lib/i18n";
import { useNotification } from "../notifications/NotificationProvider";

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

export function useActionFeedback() {
  const { t } = useI18n();
  const showNotification = useNotification();

  const getRecoverableMessage = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      const status = getStatus(error);
      const detail = getApiErrorMessage(error);
      if (status === 400) return t("actions.errorValidation", { detail });
      if (status === 403) return t("actions.errorForbidden");
      if (status === 404) return t("actions.errorUnavailable");
      if (status === 409) return t("actions.errorConflict", { detail });
      if (status === 429) return t("actions.errorRateLimited");
      if (status && status >= 500) return t("actions.errorTemporary");
      if (axios.isAxiosError(error) && !error.response) return t("actions.errorNetwork");
      if (error instanceof Error && error.message) return error.message;
      return fallbackMessage || detail || t("actions.errorGeneric");
    },
    [t],
  );

  const notifyError = useCallback(
    (error: unknown, options: RecoveryOptions = {}) => {
      const status = getStatus(error);
      const retry =
        options.retry && status !== 400 && status !== 403
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
