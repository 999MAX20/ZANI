import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { AppError } from "../../api/appError";
import { useI18n } from "../../lib/i18n";
import { canOfferActionRecovery } from "../actions/actionFeedbackPolicy";
import { Button } from "./Button";
import { RecoveryDetails } from "./RecoveryDetails";

type FallbackActionProps = {
  error: AppError;
  onRetry?: () => Promise<void> | void;
};

function FallbackAction({ error, onRetry }: FallbackActionProps) {
  const { t } = useI18n();
  const [isRetrying, setIsRetrying] = useState(false);

  if (!canOfferActionRecovery(error, Boolean(onRetry)) || !onRetry) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      isLoading={isRetrying}
      onClick={async () => {
        setIsRetrying(true);
        try {
          await onRetry();
        } finally {
          setIsRetrying(false);
        }
      }}
    >
      <RefreshCw aria-hidden="true" size={16} />
      {t("common.retry")}
    </Button>
  );
}

type SharedFallbackProps = {
  error: AppError;
  onRetry?: () => Promise<void> | void;
  title?: string;
};

export function InlineFallback({ error, onRetry, title }: SharedFallbackProps) {
  const { t } = useI18n();
  return (
    <div
      data-testid="inline-fallback"
      role="alert"
      className="rounded-card border border-[rgba(194,65,12,0.2)] bg-[var(--zani-danger-soft)] p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-zani-danger" size={18} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zani-ink">{title || t("fallback.inline.title")}</p>
            <p className="mt-1 text-sm leading-6 text-zani-subtle">{t(error.messageKey)}</p>
          </div>
        </div>
        <FallbackAction error={error} onRetry={onRetry} />
      </div>
      <RecoveryDetails error={error} className="mt-3" />
    </div>
  );
}

type PageFallbackProps = SharedFallbackProps & {
  secondaryAction?: ReactNode;
};

export function PageFallback({ error, onRetry, secondaryAction, title }: PageFallbackProps) {
  const { t } = useI18n();
  return (
    <section
      data-testid="page-fallback"
      role="alert"
      className="grid min-h-[280px] place-items-center rounded-card border border-zani-border bg-surface-card p-6 shadow-card"
    >
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-control bg-[var(--zani-danger-soft)] text-zani-danger">
          <AlertTriangle aria-hidden="true" size={24} />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-zani-ink">{title || t("fallback.page.title")}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zani-subtle">{t(error.messageKey)}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <FallbackAction error={error} onRetry={onRetry} />
          {secondaryAction}
        </div>
        <RecoveryDetails error={error} className="mx-auto mt-4 max-w-md text-left" />
      </div>
    </section>
  );
}

export function PermissionFallback({ error, title }: Pick<SharedFallbackProps, "error" | "title">) {
  const { t } = useI18n();
  return (
    <section
      data-testid="permission-fallback"
      role="alert"
      className="rounded-card border border-[rgba(183,121,31,0.22)] bg-[var(--zani-warning-soft)] p-5 shadow-card"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-surface-card text-zani-warning shadow-sm">
          <ShieldAlert aria-hidden="true" size={22} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zani-ink">{title || t("fallback.permission.title")}</h2>
          <p className="mt-2 text-sm leading-6 text-zani-subtle">{t(error.messageKey)}</p>
          <p className="mt-3 rounded-control bg-surface-card px-3 py-2 text-xs font-semibold text-zani-warning">
            {t("fallback.permission.guidance")}
          </p>
          <RecoveryDetails error={error} className="mt-3" />
        </div>
      </div>
    </section>
  );
}
