import { useEffect } from "react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";

import { normalizeAppError, type AppError } from "../../api/appError";
import { useI18n } from "../../lib/i18n";
import { captureFrontendError } from "../../lib/monitoring";
import { Button } from "./Button";
import { PageFallback } from "./FallbackSurfaces";

function getRouteAppError(error: unknown): AppError {
  if (isRouteErrorResponse(error)) {
    const category = error.status === 403 ? "permission" : error.status === 404 ? "not_found" : "internal";
    const code = category === "permission" ? "permission_denied" : category === "not_found" ? "not_found" : "internal_error";
    const messageKey = category === "permission"
      ? "routeError.forbidden"
      : category === "not_found"
        ? "routeError.notFound"
        : "routeError.generic";

    return {
      category,
      code,
      fieldErrors: {},
      messageKey,
      retryable: false,
      retryPolicy: "never_blindly",
      source: "runtime",
      status: error.status,
    };
  }

  const normalized = normalizeAppError(error);
  return {
    ...normalized,
    fieldErrors: {},
    messageKey: normalized.source === "api" ? normalized.messageKey : "routeError.generic",
    retryable: false,
    retryAfterSeconds: undefined,
    retryPolicy: "never_blindly",
  };
}

type RouteErrorViewProps = {
  error: unknown;
  onBack: () => void;
  onHome: () => void;
};

export function RouteErrorView({ error, onBack, onHome }: RouteErrorViewProps) {
  const { t } = useI18n();
  const appError = getRouteAppError(error);

  return (
    <div className="min-h-screen bg-zani-bg px-4 py-8 text-zani-ink sm:px-8">
      <div className="mx-auto max-w-3xl">
        <PageFallback
          error={appError}
          title={t("routeError.title")}
          secondaryAction={(
            <>
              <Button type="button" variant="secondary" onClick={onBack}>
                {t("routeError.back")}
              </Button>
              <Button type="button" onClick={onHome}>
                {t("routeError.home")}
              </Button>
            </>
          )}
        />
      </div>
    </div>
  );
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  useEffect(() => {
    captureFrontendError(error, { boundary: "route" });
  }, [error]);

  return <RouteErrorView error={error} onBack={() => navigate(-1)} onHome={() => navigate("/app")} />;
}
