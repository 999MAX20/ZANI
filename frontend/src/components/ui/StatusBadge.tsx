import { useI18n } from "../../lib/i18n";
import { Badge } from "./Badge";
import type { BadgeSize, BadgeVariant } from "./Badge";

type StatusTone = Exclude<BadgeVariant, "primary">;

const statusTones: Record<string, StatusTone> = {
  active: "success",
  appointment_created: "success",
  confirmed: "success",
  connected: "success",
  done: "success",
  completed: "success",
  sales: "success",
  sent: "success",

  blocked: "danger",
  cancelled: "danger",
  error: "danger",
  expired_credentials: "danger",
  failed: "danger",
  lost: "danger",
  urgent: "danger",

  high: "warning",
  in_progress: "warning",
  needs_attention: "warning",
  no_show: "warning",
  paused: "warning",
  pending: "warning",
  queued: "warning",

  contacted: "info",
  created: "info",
  friendly: "info",
  new: "info",
  normal: "info",
  open: "info",
  received: "info",
  rescheduled: "info",
  syncing: "info",
  trial: "info",

  expert: "ai",
  support: "ai",

  archived: "neutral",
  closed: "neutral",
  disabled: "neutral",
  draft: "neutral",
  formal: "neutral",
  inactive: "neutral",
  low: "neutral",
};

export function StatusBadge({ status, size = "md", className }: { status: string; size?: BadgeSize; className?: string }) {
  const { t } = useI18n();
  const labelKey = `status.${status}`;
  const label = t(labelKey);

  return (
    <Badge variant={statusTones[status] || "neutral"} size={size} className={className}>
      {label === labelKey ? status : label}
    </Badge>
  );
}
