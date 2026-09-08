import React, { useRef, useState } from "react";
import ReactDOM from "react-dom/client";

import type { AppError, AppErrorCategory } from "../../src/api/appError";
import { Button } from "../../src/components/ui/Button";
import { RouteErrorView } from "../../src/components/ui/RouteErrorBoundary";
import {
  ConnectivityBanner,
  EmptyState,
  FieldErrorSummary,
  InlineFallback,
  PageFallback,
  PermissionFallback,
} from "../../src/components/ui/StateViews";
import { I18nProvider } from "../../src/lib/i18n";
import {
  createFb010Matrix,
  fb010FailureStates,
} from "../certification/failure-certification-registry.mjs";
import "@fontsource-variable/manrope";
import "../../src/styles.css";

const rawTechnicalMarker = "SQLSTATE 42P01 token=fb010-never-render provider_secret=never-render";

const categoryCopy: Record<AppErrorCategory, string> = {
  validation: "actions.errorValidation",
  authentication: "actions.errorUnauthenticated",
  permission: "actions.errorForbidden",
  not_found: "actions.errorUnavailable",
  conflict: "actions.errorConflict",
  rate_limit: "actions.errorRateLimited",
  offline: "actions.errorNetwork",
  temporary: "actions.errorTemporary",
  provider: "actions.errorTemporary",
  internal: "actions.errorGeneric",
};

function createError(stateId: string): AppError {
  const state = fb010FailureStates.find((candidate) => candidate.id === stateId);
  const category = (state?.category === "none" ? "internal" : state?.category) as AppErrorCategory;
  const retryable = ["rate_limit", "offline", "temporary", "provider"].includes(category);
  const retryPolicies: Partial<Record<AppErrorCategory, string>> = {
    rate_limit: "server_delay_only",
    offline: "user_initiated_only",
    temporary: "safe_read_only",
    provider: "owned_status_surface_only",
  };

  return {
    category,
    code: stateId === "session_expiry" ? "token_not_valid" : `${stateId}_fb010_fixture`,
    fieldErrors: stateId === "validation"
      ? { title: [rawTechnicalMarker] }
      : {},
    messageKey: categoryCopy[category],
    requestId: "fb010-safe-reference",
    retryable,
    retryAfterSeconds: stateId === "rate_limit" ? 30 : undefined,
    retryPolicy: retryPolicies[category] || "never_blindly",
    source: category === "offline" ? "network" : stateId === "unexpected" ? "runtime" : "api",
    status: {
      validation: 400,
      authentication: 401,
      permission: 403,
      not_found: 404,
      conflict: 409,
      rate_limit: 429,
      offline: undefined,
      temporary: 503,
      provider: 503,
      internal: 500,
    }[category],
  };
}

function CertificationCell({ cell }: { cell: ReturnType<typeof createFb010Matrix>[number] }) {
  const [recovered, setRecovered] = useState(false);
  const contextRef = useRef<HTMLInputElement>(null);
  const error = createError(cell.state);
  const recover = () => setRecovered(true);
  const recoveryButton = (label: string) => (
    <Button data-testid="fb010-recovery-control" type="button" size="sm" variant="secondary" onClick={recover}>
      {label}
    </Button>
  );

  let surface: React.ReactNode;
  switch (cell.state) {
    case "success":
      surface = (
        <div role="status" className="rounded-card border border-zani-border bg-surface-card p-4 text-sm text-zani-text">
          <p>Действие завершено.</p>
          <div className="mt-3">{recoveryButton("Продолжить")}</div>
        </div>
      );
      break;
    case "empty":
      surface = (
        <EmptyState
          title="Данных пока нет"
          description="Можно создать запись или изменить условия просмотра."
          action={recoveryButton("Продолжить")}
        />
      );
      break;
    case "validation":
      surface = (
        <FieldErrorSummary
          error={error}
          fieldLabels={{ title: "Название" }}
          onFieldSelect={() => {
            contextRef.current?.focus();
            recover();
          }}
        />
      );
      break;
    case "permission":
      surface = (
        <div className="space-y-3">
          <PermissionFallback error={error} />
          {recoveryButton("Вернуться")}
        </div>
      );
      break;
    case "not_found":
      surface = <PageFallback error={error} secondaryAction={recoveryButton("К списку")} />;
      break;
    case "conflict":
      surface = (
        <div className="space-y-3">
          <InlineFallback error={error} />
          {recoveryButton("Обновить и проверить")}
        </div>
      );
      break;
    case "rate_limit":
    case "temporary":
    case "provider":
      surface = <InlineFallback error={error} onRetry={recover} />;
      break;
    case "offline":
      surface = <ConnectivityBanner error={error} onRetry={recover} />;
      break;
    case "session_expiry":
      surface = <PageFallback error={error} secondaryAction={recoveryButton("Войти снова")} />;
      break;
    case "unexpected":
      surface = (
        <RouteErrorView
          error={new Error(rawTechnicalMarker)}
          onBack={recover}
          onHome={recover}
        />
      );
      break;
    default:
      throw new Error(`Unknown FB-010 state: ${cell.state}`);
  }

  return (
    <section
      aria-label={`${cell.journey} ${cell.role} ${cell.state}`}
      className="min-w-0 space-y-3 rounded-card border border-zani-border bg-surface-card p-3"
      data-fb010-case={cell.id}
      data-fb010-category={cell.category}
      data-fb010-state={cell.state}
      data-fb010-surface={cell.expectedSurface}
      data-fb010-axe-sample={cell.journey === "J01-inbox-lead-next-action" && cell.role === "owner" ? "true" : undefined}
    >
      <p className="break-all text-xs font-semibold text-zani-faint">
        {cell.journey} / {cell.role} / {cell.state}
      </p>
      <label className="block text-xs font-semibold text-zani-subtle">
        Сохранённый контекст
        <input
          ref={contextRef}
          aria-label={`Сохранённый контекст ${cell.id}`}
          className="mt-1 block w-full rounded-control border border-zani-border bg-surface-card px-3 py-2 text-sm text-zani-text"
          defaultValue={`draft:${cell.journey}:${cell.role}`}
        />
      </label>
      {surface}
      <p data-testid="fb010-recovery-status" role="status" className="text-xs text-zani-subtle">
        {recovered ? "recovered" : "context-preserved"}
      </p>
    </section>
  );
}

function Fixture() {
  const viewport = new URLSearchParams(window.location.search).get("viewport") || "desktop-chromium";
  const cells = createFb010Matrix().filter((cell) => cell.viewport === viewport);

  return (
    <I18nProvider>
      <main className="min-h-screen bg-zani-bg p-3 text-zani-text sm:p-5" data-testid="fb010-matrix">
        <h1 className="text-xl font-semibold text-zani-ink">FB-010 failure certification</h1>
        <p className="mt-1 text-sm text-zani-subtle" data-testid="fb010-cell-count">
          {cells.length} browser cells
        </p>
        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
          {cells.map((cell) => <CertificationCell key={cell.id} cell={cell} />)}
        </div>
      </main>
    </I18nProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Fixture />
  </React.StrictMode>,
);
