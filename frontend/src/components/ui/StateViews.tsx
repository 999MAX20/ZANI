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
      className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-soft backdrop-blur-xl"
    >
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
        <Loader2 aria-hidden="true" className="animate-spin text-brand-600" size={18} />
        {resolvedLabel}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
    </div>
  );
}

export function ErrorState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-3xl border border-red-100 bg-red-50/85 p-4 text-sm text-red-700 shadow-sm sm:flex-row sm:items-start sm:justify-between"
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
      className="rounded-3xl border border-amber-100 bg-amber-50/80 p-6 shadow-soft backdrop-blur-xl"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-amber-600 shadow-sm">
          <ShieldAlert aria-hidden="true" size={24} />
        </div>
        <div>
          <p className="text-lg font-black text-midnight">{title || t("permissions.hiddenTitle")}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900/80">{message}</p>
          <p className="mt-4 rounded-2xl bg-white/75 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
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
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-8 text-center shadow-soft backdrop-blur-xl">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <Inbox aria-hidden="true" size={26} />
      </div>
      <p className="text-base font-bold text-midnight">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-2xl bg-slate-100/90", className)} />;
}

export function PageSkeleton() {
  const { t } = useI18n();
  const label = t("common.loadingWorkspace");
  return (
    <div role="status" aria-busy="true" aria-live="polite" aria-label={label} className="space-y-6">
      <SkeletonBlock className="h-20 max-w-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonBlock className="h-80" />
        <SkeletonBlock className="h-80" />
      </div>
    </div>
  );
}
