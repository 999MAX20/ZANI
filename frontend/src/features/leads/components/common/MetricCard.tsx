import type { LucideIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "../../../../lib/cn";

type MetricVariant = "default" | "success" | "info" | "danger" | "warning";

const variantClass: Record<MetricVariant, string> = {
  default: "border-gray-200 bg-gray-50 text-gray-700",
  success: "border-green-200 bg-green-50 text-green-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-700",
};

/**
 * Компактная KPI карточка для страницы заявок
 * Соответствует дизайн-референсам "банкинга бизнеса":
 * - Уменьшенные padding (p-3 вместо p-4)
 * - Компактные иконки (size={18} вместо size={24})
 * - Меньший размер шрифта для mobile
 */
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
        shouldHighlight && "ring-1 ring-offset-1",
      )}
    >
      <div className="flex items-start gap-2">
        <Icon size={18} className="mt-0.5 shrink-0 opacity-80" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">{label}</p>
          <p className="mt-0.5 text-lg font-bold leading-none text-gray-900 sm:text-xl">{value}</p>
          {delta ? <p className="mt-1 text-[10px] font-semibold text-emerald-700">{delta}</p> : null}
        </div>
      </div>
    </div>
  );
});
