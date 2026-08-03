import { AlertTriangle, CircleCheck } from "lucide-react";

import { cn } from "../../../../lib/cn";
import type { DealRow } from "../../types";
import type { Translate } from "../../types";

export function DealRiskIndicator({
  deal,
  compact = false,
  t,
}: {
  deal: Pick<DealRow, "riskLevel" | "riskPercent">;
  compact?: boolean;
  t: Translate;
}) {
  const high = deal.riskLevel === "high";
  const medium = deal.riskLevel === "medium";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap font-bold",
        compact
          ? "gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
          : "gap-1.5 rounded-lg px-2.5 py-1 text-xs",
        high && "bg-[var(--zani-danger-soft)] text-zani-danger",
        medium && "bg-[var(--zani-warning-soft)] text-zani-warning",
        deal.riskLevel === "low" &&
          "bg-[var(--zani-success-soft)] text-zani-success",
      )}
    >
      {high || medium ? <AlertTriangle size={compact ? 11 : 13} /> : <CircleCheck size={compact ? 11 : 13} />}
      {compact
        ? t("deals.riskPercentShort", { percent: deal.riskPercent })
        : high
          ? t("deals.riskHighWithPercent", { percent: deal.riskPercent })
          : medium
            ? t("deals.riskControlWithPercent", { percent: deal.riskPercent })
            : t("deals.riskNormalWithPercent", { percent: deal.riskPercent })}
    </span>
  );
}
