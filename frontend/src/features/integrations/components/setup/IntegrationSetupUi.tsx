import { providerCatalog } from "../../config/providerCatalog";
import { Button } from "../../../../components/ui/Button";
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

export function LogoMark({ logo, label }: { logo?: string; label: string }) {
  if (logo && providerLogos.has(logo)) {
    return (
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <img src={logo} alt="" className="h-7 w-7 object-contain" />
      </div>
    );
  }
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white">
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function ToggleSwitch({
  checked,
  disabled,
  isLoading,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled || isLoading}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full border p-1 transition",
        checked ? "border-emerald-200 bg-emerald-500" : "border-slate-200 bg-slate-200",
        (disabled || isLoading) && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-6" : "translate-x-0",
        )}
      />
    </button>
  );
}

export function MessengerSetupShell({
  logo,
  title,
  description,
  status,
  statusTone = "neutral",
  notice,
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
  notice?: string | null;
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
  const statusClass = {
    neutral: "bg-slate-100 text-slate-600",
    progress: "bg-blue-50 text-blue-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
  }[statusTone];

  return (
    <div className="w-full space-y-4">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <LogoMark logo={logo} label={title} />
          <div className="min-w-0">
            <p className="text-lg font-black text-midnight">{title}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-black", statusClass)}>{status}</span>
      </div>

      {error}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      {children ? <div className="rounded-2xl border border-slate-200 bg-white p-4">{children}</div> : null}

      {advanced ? (
        <div>
          <button type="button" className="text-sm font-black text-brand-700" onClick={onToggleAdvanced}>
            {advancedOpen ? t("integrations.setup.hideManualSetup") : resolvedAdvancedLabel}
          </button>
          {advancedOpen ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">{advanced}</div> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <Link to={`/dashboard/conversations?channel=${inboxChannel}`}>
          <Button type="button" variant="ghost">
            <Link2 size={16} /> {t("integrations.setup.openMessages")}
          </Button>
        </Link>
        {channelToggleVisible && onToggleChannel ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-slate-700">{t("integrations.setup.channelEnabled")}</span>
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
