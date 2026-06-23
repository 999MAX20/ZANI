import { AlertCircle, Inbox, Loader2, ShieldAlert } from "lucide-react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n();
  const resolvedLabel = label || t("common.loadingData");
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={resolvedLabel}
      className="rounded-card border border-slate-200 bg-white p-4 shadow-card"
    >
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
        <Loader2 aria-hidden="true" className="animate-spin text-brand-600" size={18} />
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
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-sm sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
        <span>{message}</span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function ForbiddenState({
  title,
  message,
}: {
  title?: string;
  message: string;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="rounded-card border border-amber-200 bg-amber-50 p-4 shadow-card"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-white text-amber-600 shadow-sm">
          <ShieldAlert aria-hidden="true" size={22} />
        </div>
        <div>
          <p className="text-lg font-black text-midnight">{title || t("permissions.hiddenTitle")}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900/80">{message}</p>
          <p className="mt-3 rounded-control bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">
            {t("permissions.hiddenText")}
          </p>
        </div>
      </div>
    </div>
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
    <div className="rounded-card border border-dashed border-slate-200 bg-white p-6 text-center shadow-card">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-control bg-slate-100 text-slate-500">
        <Inbox aria-hidden="true" size={22} />
      </div>
      <p className="text-base font-bold text-midnight">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-slate-100", className)} />;
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
