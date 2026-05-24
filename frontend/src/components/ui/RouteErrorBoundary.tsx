import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";

import { Button } from "./Button";
import { ErrorState } from "./StateViews";
import { getApiErrorMessage } from "../../api/client";

function getRouteErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return "Страница не найдена или больше недоступна.";
    if (error.status === 403) return "У вашей роли нет доступа к этому разделу.";
    return error.statusText || "Не удалось открыть раздел.";
  }
  if (error instanceof Error) return error.message;
  return getApiErrorMessage(error);
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-app-gradient px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <ErrorState
          message={getRouteErrorMessage(error)}
          action={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Назад
              </Button>
              <Button type="button" onClick={() => navigate("/dashboard")}>
                На главную
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
