import React from "react";
import ReactDOM from "react-dom/client";

import type { AppError } from "../../src/api/appError";
import { NotificationProvider, useNotification } from "../../src/components/notifications/NotificationProvider";
import { Button } from "../../src/components/ui/Button";
import {
  ConnectivityBanner,
  FieldErrorSummary,
  ForbiddenState,
  InlineFallback,
  PageFallback,
} from "../../src/components/ui/StateViews";
import { I18nProvider } from "../../src/lib/i18n";
import "@fontsource-variable/manrope";
import "../../src/styles.css";

const baseError = {
  fieldErrors: {},
  retryable: false,
  retryPolicy: "never_blindly",
  source: "api",
  status: 500,
} as const;

const temporaryError: AppError = {
  ...baseError,
  category: "temporary",
  code: "temporary_service_failure",
  messageKey: "actions.errorTemporary",
  requestId: "support-reference-7",
  retryable: true,
};

const offlineError: AppError = {
  ...baseError,
  category: "offline",
  code: "network_unavailable",
  messageKey: "actions.errorNetwork",
  retryable: true,
  retryPolicy: "user_initiated_only",
  source: "network",
  status: undefined,
};

const permissionError: AppError = {
  ...baseError,
  category: "permission",
  code: "permission_denied",
  messageKey: "actions.errorForbidden",
  status: 403,
};

const validationError: AppError = {
  ...baseError,
  category: "validation",
  code: "validation_error",
  fieldErrors: {
    email: ["Введите корректный email."],
    password: ["Пароль должен содержать не менее 8 символов."],
  },
  messageKey: "actions.errorValidation",
  status: 400,
};

function ToastTrigger() {
  const notify = useNotification();
  return (
    <Button
      data-testid="show-error-toast"
      type="button"
      onClick={() => notify({
        appError: temporaryError,
        actionLabel: "Повторить",
        onAction: () => undefined,
      })}
    >
      Показать уведомление
    </Button>
  );
}

function Fixture() {
  return (
    <I18nProvider>
      <NotificationProvider>
        <main className="min-h-screen bg-zani-bg p-4 text-zani-text sm:p-6">
          <div className="mx-auto max-w-5xl space-y-5">
            <ConnectivityBanner error={offlineError} onRetry={() => undefined} />
            <InlineFallback error={temporaryError} onRetry={() => undefined} />
            <div className="grid gap-5 lg:grid-cols-2">
              <ForbiddenState error={permissionError} />
              <FieldErrorSummary
                error={validationError}
                fieldLabels={{ email: "Email", password: "Пароль" }}
                onFieldSelect={() => undefined}
              />
            </div>
            <PageFallback
              error={temporaryError}
              onRetry={() => undefined}
              secondaryAction={<Button type="button" variant="ghost">На главную</Button>}
            />
            <ToastTrigger />
          </div>
        </main>
      </NotificationProvider>
    </I18nProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Fixture />
  </React.StrictMode>,
);
