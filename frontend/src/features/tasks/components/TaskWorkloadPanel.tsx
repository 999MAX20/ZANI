import { AlertTriangle, CheckCircle2, Clock3, UserRound } from "lucide-react";

import type { TaskWorkloadItem, TaskWorkloadResponse } from "../../../api/tasks";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";

type TaskWorkloadPanelProps = {
  workload?: TaskWorkloadResponse;
  selectedAssignee: string;
  onSelectAssignee: (value: string) => void;
};

export function TaskWorkloadPanel({ workload, selectedAssignee, onSelectAssignee }: TaskWorkloadPanelProps) {
  const { t } = useI18n();
  if (!workload) return null;

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">{t("tasks.workloadTitle")}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {t("tasks.workloadActiveCount", { count: workload.totals.active_tasks })} · {t("tasks.workloadAssigneeCount", { count: workload.totals.assignees })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkloadTotal label={t("tasks.workloadOverdue")} value={workload.totals.overdue} tone="red" />
          <WorkloadTotal label={t("tasks.workloadToday")} value={workload.totals.due_today} tone="amber" />
          <WorkloadTotal label={t("tasks.workloadPriority")} value={workload.totals.high_priority} tone="brand" />
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        {workload.items.map((item) => (
          <WorkloadAssigneeCard
            key={`${item.type}-${item.user_id || "unassigned"}`}
            item={item}
            selectedAssignee={selectedAssignee}
            onSelectAssignee={onSelectAssignee}
          />
        ))}
      </div>
    </section>
  );
}

function WorkloadAssigneeCard({
  item,
  selectedAssignee,
  onSelectAssignee,
}: {
  item: TaskWorkloadItem;
  selectedAssignee: string;
  onSelectAssignee: (value: string) => void;
}) {
  const { t } = useI18n();
  const assigneeValue = item.user_id ? String(item.user_id) : "unassigned";
  const isSelected = selectedAssignee === assigneeValue;
  const title = item.type === "unassigned" ? t("tasks.noAssignee") : item.name || item.email || t("tasks.noAssignee");

  return (
    <button
      type="button"
      className={`min-h-[168px] rounded-lg border p-4 text-left transition ${
        isSelected ? "border-brand-300 bg-brand-50 shadow-sm" : "border-slate-100 bg-slate-50 hover:border-brand-200 hover:bg-white"
      }`}
      onClick={() => onSelectAssignee(isSelected ? "" : assigneeValue)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${item.type === "unassigned" ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-700"}`}>
            <UserRound size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-midnight">{title}</span>
            {item.email ? <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{item.email}</span> : null}
          </span>
        </div>
        <span className={capacityClass(item.capacity_status)}>{capacityLabel(item.capacity_status, t)}</span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <WorkloadMetric label={t("tasks.workloadOpen")} value={item.open} />
        <WorkloadMetric label={t("tasks.workloadProgress")} value={item.in_progress} />
        <WorkloadMetric label={t("tasks.workloadOverdue")} value={item.overdue} tone="red" />
        <WorkloadMetric label={t("tasks.workloadToday")} value={item.due_today} tone="amber" />
      </div>
      {item.oldest_due_at ? (
        <p className="mt-3 flex items-center gap-1.5 truncate text-xs font-semibold text-slate-500">
          <Clock3 size={13} />
          {t("tasks.workloadOldest")}: {formatDateTime(item.oldest_due_at)}
        </p>
      ) : null}
    </button>
  );
}

function WorkloadMetric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "red" | "amber" }) {
  const valueClass = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-midnight";
  return (
    <span className="rounded-md bg-white px-2 py-2 text-center ring-1 ring-slate-100">
      <span className={`block text-base font-black ${valueClass}`}>{value}</span>
      <span className="mt-0.5 block truncate text-[10px] font-bold uppercase text-slate-500">{label}</span>
    </span>
  );
}

function WorkloadTotal({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "brand" }) {
  const Icon = tone === "red" ? AlertTriangle : tone === "amber" ? Clock3 : CheckCircle2;
  const toneClass = tone === "red" ? "bg-red-50 text-red-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-700";
  return (
    <span className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-black ${toneClass}`}>
      <Icon size={14} />
      {label}: {value}
    </span>
  );
}

function capacityLabel(status: string, t: (key: string) => string) {
  const key = `tasks.workloadStatus.${status}`;
  const value = t(key);
  return value === key ? status : value;
}

function capacityClass(status: string) {
  if (status === "overloaded") return "shrink-0 rounded-full bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-red-700 ring-1 ring-red-200";
  if (status === "busy") return "shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black uppercase text-amber-700 ring-1 ring-amber-200";
  if (status === "idle") return "shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600 ring-1 ring-slate-200";
  return "shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700 ring-1 ring-emerald-200";
}
