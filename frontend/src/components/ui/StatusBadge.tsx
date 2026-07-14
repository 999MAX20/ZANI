import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

const styles: Record<string, string> = {
  new: "bg-sky-50 text-sky-700 ring-sky-200",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-200",
  appointment_created: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  contacted: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  closed: "bg-slate-100 text-slate-700 ring-slate-200",
  lost: "bg-red-50 text-red-700 ring-red-200",
  created: "bg-sky-50 text-sky-700 ring-sky-200",
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
  rescheduled: "bg-violet-50 text-violet-700 ring-violet-200",
  completed: "bg-slate-100 text-slate-700 ring-slate-200",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  no_show: "bg-orange-50 text-orange-700 ring-orange-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  inactive: "bg-slate-100 text-slate-700 ring-slate-200",
  trial: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  blocked: "bg-red-50 text-red-700 ring-red-200",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  paused: "bg-amber-50 text-amber-700 ring-amber-200",
  connected: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  needs_attention: "bg-amber-50 text-amber-700 ring-amber-200",
  syncing: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  disabled: "bg-slate-100 text-slate-700 ring-slate-200",
  expired_credentials: "bg-red-50 text-red-700 ring-red-200",
  error: "bg-red-50 text-red-700 ring-red-200",
  open: "bg-sky-50 text-sky-700 ring-sky-200",
  archived: "bg-slate-100 text-slate-700 ring-slate-200",
  received: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  queued: "bg-amber-50 text-amber-700 ring-amber-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  sent: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  low: "bg-slate-100 text-slate-700 ring-slate-200",
  normal: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  high: "bg-amber-50 text-amber-700 ring-amber-200",
  urgent: "bg-red-50 text-red-700 ring-red-200",
  friendly: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  expert: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  formal: "bg-slate-100 text-slate-700 ring-slate-200",
  sales: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  support: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const labelKey = `status.${status}`;
  const label = t(labelKey);

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", styles[status] || styles.closed)}>
      {label === labelKey ? status : label}
    </span>
  );
}
