import { providerCatalog } from "../../config/providerCatalog";
import { cn } from "../../../../lib/cn";

const providerLogos = new Set(
  providerCatalog
    .map((item) => item.logo)
    .filter(Boolean),
);

export function LogoMark({ logo, label }: { logo?: string; label: string }) {
  if (logo && providerLogos.has(logo)) {
    return (
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <img src={logo} alt="" className="h-8 w-8 object-contain" />
      </div>
    );
  }
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white">
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
        "relative h-8 w-14 rounded-full border p-1 transition",
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
