import { RefreshCw, ShieldAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { AppError } from "../../api/appError";
import { useI18n } from "../../lib/i18n";
import { canOfferActionRecovery } from "../actions/actionFeedbackPolicy";
import { Button } from "./Button";
import { RecoveryDetails } from "./RecoveryDetails";
import { appErrorNoticeTone, statusNoticeTones, StatusNotice, type StatusNoticeTone } from "./StatusNotice";

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
    <StatusNotice
      data-testid="inline-fallback"
      tone={appErrorNoticeTone(error)}
      title={title || t("fallback.inline.title")}
      description={t(error.messageKey)}
      action={<FallbackAction error={error} onRetry={onRetry} />}
      details={<RecoveryDetails error={error} />}
    />
  );
}

type PageFallbackProps = SharedFallbackProps & {
  secondaryAction?: ReactNode;
};

type PageFallbackLayoutProps = {
  actions?: ReactNode;
  details?: ReactNode;
  message: string;
  testId?: string;
  title: string;
  tone?: StatusNoticeTone;
};

export function PageFallbackLayout({
  actions,
  details,
  message,
  testId = "page-fallback",
  title,
  tone = "danger",
}: PageFallbackLayoutProps) {
  const toneDefinition = statusNoticeTones[tone];
  const Icon = toneDefinition.Icon;
  return (
    <section
      data-testid={testId}
      role="alert"
      className="grid min-h-[280px] place-items-center rounded-card border border-zani-border bg-surface-card p-6 shadow-card"
    >
      <div className="w-full max-w-xl text-center">
        <div className={`mx-auto grid h-12 w-12 place-items-center rounded-control border ${toneDefinition.container} ${toneDefinition.icon}`}>
          <Icon aria-hidden="true" size={24} />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-zani-ink">{title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zani-subtle">{message}</p>
        {actions ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div> : null}
        {details}
      </div>
    </section>
  );
}

export function PageFallback({ error, onRetry, secondaryAction, title }: PageFallbackProps) {
  const { t } = useI18n();
  return (
    <PageFallbackLayout
      title={title || t("fallback.page.title")}
      message={t(error.messageKey)}
      tone={appErrorNoticeTone(error)}
      actions={(
        <>
          <FallbackAction error={error} onRetry={onRetry} />
          {secondaryAction}
        </>
      )}
      details={<RecoveryDetails error={error} className="mx-auto mt-4 max-w-md text-left" />}
    />
  );
}

export function PermissionFallback({ error, title }: Pick<SharedFallbackProps, "error" | "title">) {
  const { t } = useI18n();
  return (
    <StatusNotice
      data-testid="permission-fallback"
      tone="warning"
      icon={ShieldAlert}
      title={title || t("fallback.permission.title")}
      description={t(error.messageKey)}
      details={(
        <>
          <p className="rounded-control bg-surface-card px-3 py-2 text-xs font-semibold text-zani-warning">
            {t("fallback.permission.guidance")}
          </p>
          <RecoveryDetails error={error} className="mt-3" />
        </>
      )}
    />
  );
}
