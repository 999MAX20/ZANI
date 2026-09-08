import { RefreshCw, WifiOff } from "lucide-react";

import type { AppError } from "../../api/appError";
import { useI18n } from "../../lib/i18n";
import { canOfferActionRecovery } from "../actions/actionFeedbackPolicy";
import { Button } from "./Button";
import { StatusNotice } from "./StatusNotice";

type ConnectivityBannerProps = {
  error: AppError;
  isReconnecting?: boolean;
  onRetry?: () => Promise<void> | void;
};

export function ConnectivityBanner({ error, isReconnecting = false, onRetry }: ConnectivityBannerProps) {
  const { t } = useI18n();
  const canRetry = !isReconnecting && canOfferActionRecovery(error, Boolean(onRetry));

  return (
    <StatusNotice
      data-testid="connectivity-banner"
      tone="warning"
      role="status"
      ariaLive="polite"
      compact
      className="rounded-none border-x-0 border-t-0 shadow-none"
      icon={isReconnecting ? RefreshCw : WifiOff}
      iconClassName={isReconnecting ? "animate-spin motion-reduce:animate-none" : undefined}
      title={t(isReconnecting ? "fallback.connectivity.reconnectingTitle" : "fallback.connectivity.offlineTitle")}
      description={t(error.messageKey)}
      action={canRetry && onRetry ? (
        <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    />
  );
}
