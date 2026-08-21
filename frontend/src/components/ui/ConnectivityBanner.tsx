import { RefreshCw, WifiOff } from "lucide-react";

import type { AppError } from "../../api/appError";
import { useI18n } from "../../lib/i18n";
import { canOfferActionRecovery } from "../actions/actionFeedbackPolicy";
import { Button } from "./Button";

type ConnectivityBannerProps = {
  error: AppError;
  isReconnecting?: boolean;
  onRetry?: () => Promise<void> | void;
};

export function ConnectivityBanner({ error, isReconnecting = false, onRetry }: ConnectivityBannerProps) {
  const { t } = useI18n();
  const canRetry = !isReconnecting && canOfferActionRecovery(error, Boolean(onRetry));

  return (
    <div
      data-testid="connectivity-banner"
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 border-b border-[rgba(183,121,31,0.22)] bg-[var(--zani-warning-soft)] px-4 py-3 text-sm sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {isReconnecting ? (
          <RefreshCw aria-hidden="true" className="mt-0.5 shrink-0 animate-spin text-zani-warning" size={18} />
        ) : (
          <WifiOff aria-hidden="true" className="mt-0.5 shrink-0 text-zani-warning" size={18} />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-zani-ink">
            {t(isReconnecting ? "fallback.connectivity.reconnectingTitle" : "fallback.connectivity.offlineTitle")}
          </p>
          <p className="mt-0.5 leading-5 text-zani-subtle">{t(error.messageKey)}</p>
        </div>
      </div>
      {canRetry && onRetry ? (
        <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}
