import { useEffect } from "react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";

import { Button } from "./Button";
import { ErrorState } from "./StateViews";
import { getApiErrorMessage } from "../../api/client";
import { useI18n } from "../../lib/i18n";
import { captureFrontendError } from "../../lib/monitoring";

function getRouteErrorMessage(error: unknown, t: (key: string) => string) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return t("routeError.notFound");
    if (error.status === 403) return t("routeError.forbidden");
    return error.statusText || t("routeError.generic");
  }
  if (error instanceof Error) return error.message;
  return getApiErrorMessage(error);
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    captureFrontendError(error, { boundary: "route" });
  }, [error]);

  return (
    <div className="min-h-screen bg-app-gradient px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <ErrorState
          message={getRouteErrorMessage(error, t)}
          action={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                {t("routeError.back")}
              </Button>
              <Button type="button" onClick={() => navigate("/dashboard")}>
                {t("routeError.home")}
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
