import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/cn";
import { Card, CardBody } from "./Card";

export type UiTone = "brand" | "ai" | "green" | "amber" | "red" | "slate";

const toneClasses: Record<UiTone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  ai: "bg-ai-50 text-ai-700 ring-ai-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  slate: "bg-slate-100 text-midnight ring-slate-200",
};

export function IconBubble({
  icon: Icon,
  tone = "slate",
  className,
}: {
  icon: LucideIcon;
  tone?: UiTone;
  className?: string;
}) {
  return (
    <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1", toneClasses[tone], className)}>
      <Icon size={21} />
    </div>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  icon,
  tone = "slate",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: UiTone;
  className?: string;
}) {
  return (
    <Card className={cn("group overflow-hidden", className)}>
      <CardBody className="relative flex items-start gap-4">
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-brand-100/35 blur-3xl transition group-hover:bg-ai-100/50" />
        <IconBubble icon={icon} tone={tone} className="relative" />
        <div className="relative min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-midnight">{value}</p>
          {hint ? <p className="mt-1 text-xs font-medium text-slate-400">{hint}</p> : null}
        </div>
      </CardBody>
    </Card>
  );
}

