import { ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "../../lib/cn";

export type AiInsightSeverity = "critical" | "warning" | "good" | "info";

const iconTone: Record<AiInsightSeverity, string> = {
  critical: "border-red-100 bg-red-50/80 text-red-700",
  warning: "border-amber-100 bg-amber-50/80 text-amber-700",
  good: "border-emerald-100 bg-emerald-50/80 text-emerald-700",
  info: "border-violet-100 bg-violet-50/80 text-violet-700",
};

const severityDot: Record<AiInsightSeverity, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-400",
  good: "bg-emerald-500",
  info: "bg-sky-500",
};

export function aiInsightDotClass(severity: AiInsightSeverity) {
  return severityDot[severity];
}

type AiInsightCardProps = {
  title: string;
  description: string;
  actionLabel?: string;
  href?: string;
  icon: LucideIcon;
  severity?: AiInsightSeverity;
  compact?: boolean;
  className?: string;
};

export function AiInsightCard({
  title,
  description,
  actionLabel,
  href,
  icon: Icon,
  severity = "info",
  compact = false,
  className,
}: AiInsightCardProps) {
  const content = (
    <>
      <div
        className={cn(
          "grid shrink-0 place-items-center rounded-2xl border",
          compact ? "h-10 w-10" : "h-12 w-12",
          iconTone[severity],
        )}
      >
        <Icon size={compact ? 19 : 22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-midnight">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {actionLabel ? (
        <div className="inline-flex items-center gap-2 text-sm font-black text-brand-700">
          {actionLabel}
          {href ? <ArrowRight size={16} className="transition group-hover:translate-x-1" /> : null}
        </div>
      ) : null}
    </>
  );

  const baseClassName = cn(
    "zani-ai-surface group flex flex-col gap-4 rounded-xl p-4 transition-colors sm:flex-row sm:items-center",
    href ? "hover:border-brand-200" : "",
    className,
  );

  if (!href) {
    return <div className={baseClassName}>{content}</div>;
  }

  return (
    <Link to={href} className={baseClassName}>
      {content}
    </Link>
  );
}
