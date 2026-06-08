import type { LucideIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "../../../../lib/cn";

type MetricVariant = "default" | "success" | "info" | "danger" | "warning";

const variantClass: Record<MetricVariant, string> = {
  default: "border-gray-200 bg-gray-50 text-gray-700 ring-gray-500",
  success: "border-green-200 bg-green-50 text-green-700 ring-green-500",
  info: "border-blue-200 bg-blue-50 text-blue-700 ring-blue-500",
  danger: "border-red-200 bg-red-50 text-red-700 ring-red-500",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-700 ring-yellow-500",
};

export const MetricCard = memo(function MetricCard({
  icon: Icon,
  label,
  value,
  delta,
  variant = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  delta?: string;
  variant?: MetricVariant;
}) {
  const shouldHighlight = typeof value === "number" ? value > 0 : Boolean(value);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all duration-200 hover:shadow-md",
        variantClass[variant],
        shouldHighlight && "ring-2 ring-offset-2 animate-pulse-slow",
      )}
    >
      <div className="flex items-start gap-2">
        <Icon size={24} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <p className="mt-1 text-xl font-bold leading-none text-gray-900">{value}</p>
          {delta ? <p className="mt-1 text-xs font-semibold text-emerald-700">{delta}</p> : null}
        </div>
      </div>
    </div>
  );
});
