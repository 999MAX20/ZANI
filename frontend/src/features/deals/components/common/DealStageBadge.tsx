import { cn } from "../../../../lib/cn";
import type { PipelineStage } from "../../../../types";
import type { Translate } from "../../types";

export function DealStageBadge({ stage, fallback }: { stage?: PipelineStage; fallback: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage?.color || "#2563eb" }} />
      <span className="truncate">{stage?.name || fallback}</span>
    </span>
  );
}

export function StatusPill({ status, t }: { status: "open" | "won" | "lost"; t: Translate }) {
  const label = status === "won" ? t("deals.statusWon") : status === "lost" ? t("deals.statusLost") : t("deals.statusOpen");
  return (
    <span
      className={cn(
        "inline-flex rounded-lg px-2.5 py-1 text-xs font-bold",
        status === "won" && "bg-emerald-50 text-emerald-700",
        status === "lost" && "bg-red-50 text-red-700",
        status === "open" && "bg-slate-100 text-slate-700",
      )}
    >
      {label}
    </span>
  );
}
