import { providerCatalog } from "../../config/providerCatalog";
import { Badge, type BadgeVariant } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { ToggleSwitch } from "../../../../components/ui/Switch";
import { cn } from "../../../../lib/cn";
import { useI18n } from "../../../../lib/i18n";
import { Link } from "react-router-dom";
import { Link2 } from "lucide-react";
import type { ReactNode } from "react";

const providerLogos = new Set(
  providerCatalog
    .map((item) => item.logo)
    .filter(Boolean),
);

export function LogoMark({ logo, label, compact = false }: { logo?: string; label: string; compact?: boolean }) {
  const containerClassName = compact ? "h-9 w-9 rounded-control" : "h-11 w-11 rounded-control";
  const imageClassName = compact ? "h-6 w-6" : "h-7 w-7";

  if (logo && providerLogos.has(logo)) {
    return (
      <div className={cn("grid shrink-0 place-items-center overflow-hidden border border-zani-border bg-surface-card shadow-sm", containerClassName)}>
        <img src={logo} alt="" className={cn("object-contain", imageClassName)} />
      </div>
    );
  }
  return (
    <div className={cn("grid shrink-0 place-items-center bg-brand-600 font-bold text-white", compact ? "text-xs" : "text-sm", containerClassName)}>
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}

export { ToggleSwitch };


export function MessengerSetupShell({
  logo,
  title,
  description,
  status,
  statusTone = "neutral",
  error,
  children,
  advanced,
  advancedOpen,
  advancedLabel,
  onToggleAdvanced,
  channelEnabled,
  channelToggleVisible,
  channelToggleLoading,
  canManage,
  inboxChannel,
  onToggleChannel,
}: {
  logo?: string;
  title: string;
  description: string;
  status: string;
  statusTone?: "neutral" | "progress" | "success" | "warning";
  error?: ReactNode;
  children?: ReactNode;
  advanced?: ReactNode;
  advancedOpen?: boolean;
  advancedLabel?: string;
  onToggleAdvanced?: () => void;
  channelEnabled?: boolean;
  channelToggleVisible?: boolean;
  channelToggleLoading?: boolean;
  canManage: boolean;
  inboxChannel: string;
  onToggleChannel?: (checked: boolean) => void;
}) {
  const { t } = useI18n();
  const resolvedAdvancedLabel = advancedLabel || t("integrations.setup.needHelp");
  const statusVariant: Record<NonNullable<typeof statusTone>, BadgeVariant> = {
    neutral: "neutral",
    progress: "info",
    success: "success",
    warning: "warning",
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-start justify-between gap-4 border-b border-zani-border pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <LogoMark logo={logo} label={title} />
          <div className="min-w-0">
            <p className="text-lg font-bold text-zani-text">{title}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-zani-subtle">{description}</p>
          </div>
        </div>
        <Badge variant={statusVariant[statusTone]} size="md" className="shrink-0">
          {status}
        </Badge>
      </div>

      {error}

      {children ? <div className="rounded-card border border-zani-border bg-surface-card p-4">{children}</div> : null}

      {advanced ? (
        <div>
          <button type="button" className="text-sm font-bold text-brand-700" onClick={onToggleAdvanced}>
            {advancedOpen ? t("integrations.setup.hideManualSetup") : resolvedAdvancedLabel}
          </button>
          {advancedOpen ? <div className="mt-3 rounded-card border border-zani-border bg-surface-muted p-4">{advanced}</div> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface-muted px-4 py-3">
        <Link to={`/app/conversations?channel=${inboxChannel}`}>
          <Button type="button" variant="ghost">
            <Link2 size={16} /> {t("integrations.setup.openMessages")}
          </Button>
        </Link>
        {channelToggleVisible && onToggleChannel ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-zani-text">{t("integrations.setup.channelEnabled")}</span>
            <ToggleSwitch
              checked={Boolean(channelEnabled)}
              disabled={!canManage}
              isLoading={channelToggleLoading}
              label={t("integrations.setup.toggleChannel", { title })}
              onChange={onToggleChannel}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
