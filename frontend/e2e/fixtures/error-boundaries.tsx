import React, { useState } from "react";
import ReactDOM from "react-dom/client";

import { AppErrorBoundary } from "../../src/components/ui/AppErrorBoundary";
import { Button } from "../../src/components/ui/Button";
import { RouteErrorView } from "../../src/components/ui/RouteErrorBoundary";
import { I18nProvider } from "../../src/lib/i18n";
import "@fontsource-variable/manrope";
import "../../src/styles.css";

const APP_TECHNICAL_ERROR = "SQLSTATE 42P01 at /srv/zani/private.py token=never-show-this";
const ROUTE_TECHNICAL_ERROR = "ChunkLoadError: /private/admin-route.tsx failed";

function TechnicalCrash(): never {
  throw new Error(APP_TECHNICAL_ERROR);
}

function AppBoundaryDemo() {
  const [shouldCrash, setShouldCrash] = useState(false);
  const [monitoringCaptured, setMonitoringCaptured] = useState(false);

  return (
    <section aria-labelledby="app-boundary-heading" className="space-y-3">
      <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-card">
        <h1 id="app-boundary-heading" className="text-lg font-semibold text-zani-ink">Сбой приложения</h1>
        <p data-testid="app-monitoring-status" className="mt-1 text-sm text-zani-subtle">
          {monitoringCaptured ? "Исходная ошибка передана в мониторинг" : "Ожидается тестовый сбой"}
        </p>
      </div>
      <AppErrorBoundary
        onErrorCaptured={(error) => {
          setMonitoringCaptured(error instanceof Error && error.message === APP_TECHNICAL_ERROR);
        }}
      >
        {shouldCrash ? (
          <TechnicalCrash />
        ) : (
          <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-card">
            <Button data-testid="trigger-app-crash" type="button" onClick={() => setShouldCrash(true)}>
              Вызвать тестовый сбой
            </Button>
          </div>
        )}
      </AppErrorBoundary>
    </section>
  );
}

function Fixture() {
  return (
    <I18nProvider>
      <main className="min-h-screen bg-zani-bg p-4 text-zani-text sm:p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <AppBoundaryDemo />
          <section aria-labelledby="route-boundary-heading" className="space-y-3">
            <h2 id="route-boundary-heading" className="text-lg font-semibold text-zani-ink">Сбой маршрута</h2>
            <RouteErrorView
              error={new Error(ROUTE_TECHNICAL_ERROR)}
              onBack={() => undefined}
              onHome={() => undefined}
            />
          </section>
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
