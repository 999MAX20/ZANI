import { Inbox, Loader2, ShieldAlert } from "lucide-react";

import type { AppError } from "../../api/appError";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { PermissionFallback } from "./FallbackSurfaces";
import { StatusNotice } from "./StatusNotice";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n();
  const resolvedLabel = label || t("common.loadingData");
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={resolvedLabel}
      className="rounded-card border border-zani-border bg-surface-card p-4 shadow-card"
    >
      <div className="flex items-center gap-3 text-sm font-semibold text-zani-subtle">
        <Loader2 aria-hidden="true" className="animate-spin text-brand-700" size={18} />
        {resolvedLabel}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-16" />
      </div>
    </div>
  );
}

export function ErrorState({ message, action }: { message: string; action?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <StatusNotice
      tone="danger"
      title={t("fallback.inline.title")}
      description={message}
      action={action}
    />
  );
}

export function ForbiddenState({
  error,
  title,
  message,
}: {
  error?: AppError;
  title?: string;
  message?: string;
}) {
  const { t } = useI18n();
  if (error) return <PermissionFallback error={error} title={title} />;

  return (
    <StatusNotice
      tone="warning"
      icon={ShieldAlert}
      title={title || t("permissions.hiddenTitle")}
      description={message || t("actions.errorForbidden")}
      details={(
        <p className="rounded-control bg-surface-card px-3 py-2 text-xs font-semibold text-zani-warning">
          {t("permissions.hiddenText")}
        </p>
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-zani-border bg-surface-card p-6 text-center shadow-card">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-control bg-surface-muted text-zani-subtle">
        <Inbox aria-hidden="true" size={22} />
      </div>
      <p className="text-base font-semibold text-zani-ink">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zani-subtle">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-surface-muted", className)} />;
}

export function PageSkeleton() {
  const { t } = useI18n();
  const label = t("common.loadingWorkspace");
  return (
    <div role="status" aria-busy="true" aria-live="polite" aria-label={label} className="space-y-4">
      <SkeletonBlock className="h-16 max-w-3xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>
    </div>
  );
}

export { ConnectivityBanner } from "./ConnectivityBanner";
export { FieldErrorSummary } from "./FieldErrorSummary";
export { InlineFallback, PageFallback, PermissionFallback } from "./FallbackSurfaces";
export { RecoveryDetails } from "./RecoveryDetails";
