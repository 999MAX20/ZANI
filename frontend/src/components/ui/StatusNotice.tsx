import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import type { AppError } from "../../api/appError";
import { cn } from "../../lib/cn";

export type StatusNoticeTone = "success" | "info" | "warning" | "danger";

type ToneDefinition = {
  Icon: LucideIcon;
  container: string;
  icon: string;
};

export const statusNoticeTones: Record<StatusNoticeTone, ToneDefinition> = {
  success: {
    Icon: CheckCircle2,
    container: "border-[rgba(21,128,61,0.18)] bg-[var(--zani-success-soft)]",
    icon: "text-zani-success",
  },
  info: {
    Icon: Info,
    container: "border-[rgba(14,116,144,0.18)] bg-[var(--zani-info-soft)]",
    icon: "text-zani-info",
  },
  warning: {
    Icon: AlertTriangle,
    container: "border-[rgba(183,121,31,0.22)] bg-[var(--zani-warning-soft)]",
    icon: "text-zani-warning",
  },
  danger: {
    Icon: AlertCircle,
    container: "border-[rgba(194,65,12,0.2)] bg-[var(--zani-danger-soft)]",
    icon: "text-zani-danger",
  },
};

export function appErrorNoticeTone(error: AppError): StatusNoticeTone {
  if (error.category === "not_found") return "info";
  if (["authentication", "permission", "conflict", "rate_limit", "offline", "provider"].includes(error.category)) {
    return "warning";
  }
  return "danger";
}

type StatusNoticeProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  action?: ReactNode;
  ariaLive?: "assertive" | "off" | "polite";
  compact?: boolean;
  description?: ReactNode;
  details?: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  title: ReactNode;
  tone?: StatusNoticeTone;
};

export function StatusNotice({
  action,
  ariaLive,
  className,
  compact = false,
  description,
  details,
  icon: IconOverride,
  iconClassName,
  role,
  title,
  tone = "info",
  ...props
}: StatusNoticeProps) {
  const definition = statusNoticeTones[tone];
  const Icon = IconOverride || definition.Icon;
  const resolvedRole = role || (tone === "danger" ? "alert" : "status");
  const resolvedLive = ariaLive || (resolvedRole === "alert" ? "assertive" : "polite");

  return (
    <div
      {...props}
      role={resolvedRole}
      aria-live={resolvedLive}
      className={cn(
        "rounded-card border text-zani-text shadow-sm",
        compact ? "p-3" : "p-4",
        definition.container,
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Icon
            aria-hidden="true"
            className={cn("mt-0.5 shrink-0", definition.icon, iconClassName)}
            size={18}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zani-ink">{title}</p>
            {description ? <div className="mt-1 text-sm leading-6 text-zani-subtle">{description}</div> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {details ? <div className="mt-3">{details}</div> : null}
    </div>
  );
}
