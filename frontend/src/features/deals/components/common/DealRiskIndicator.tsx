import { AlertTriangle, CircleCheck } from "lucide-react";

import { cn } from "../../../../lib/cn";
import type { DealRow } from "../../types";
import type { Translate } from "../../types";

export function DealRiskIndicator({ deal, compact = false, t }: { deal: Pick<DealRow, "riskLevel" | "riskPercent">; compact?: boolean; t: Translate }) {
  const high = deal.riskLevel === "high";
  const medium = deal.riskLevel === "medium";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold",
        high && "bg-red-50 text-red-700",
        medium && "bg-amber-50 text-amber-700",
        deal.riskLevel === "low" && "bg-emerald-50 text-emerald-700",
      )}
    >
      {high || medium ? <AlertTriangle size={13} /> : <CircleCheck size={13} />}
      {compact ? `${deal.riskPercent}%` : high ? t("deals.riskHighWithPercent", { percent: deal.riskPercent }) : medium ? t("deals.riskControlWithPercent", { percent: deal.riskPercent }) : t("deals.riskNormalWithPercent", { percent: deal.riskPercent })}
    </span>
  );
}
