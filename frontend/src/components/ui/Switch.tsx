import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

type SwitchTone = "brand" | "ai" | "success";
type SwitchSize = "md" | "dense";

type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  label: string;
  isLoading?: boolean;
  onChange: (checked: boolean) => void;
  size?: SwitchSize;
  tone?: SwitchTone;
};

const toneClasses: Record<SwitchTone, string> = {
  brand: "border-brand-500 bg-brand-500",
  ai: "border-ai-600 bg-ai-600",
  success: "border-zani-success bg-zani-success",
};

const sizeClasses: Record<SwitchSize, { track: string; knob: string; translate: string }> = {
  md: {
    track: "h-7 w-12",
    knob: "h-[22px] w-[22px]",
    translate: "translate-x-5",
  },
  dense: {
    track: "h-6 w-10",
    knob: "h-[18px] w-[18px]",
    translate: "translate-x-4",
  },
};

export function Switch({
  checked,
  className,
  disabled,
  isLoading,
  label,
  onChange,
  size = "md",
  tone = "brand",
  ...props
}: SwitchProps) {
  const disabledState = Boolean(disabled || isLoading);
  const sizing = sizeClasses[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={isLoading || undefined}
      disabled={disabledState}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border p-0.5 transition duration-150",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55",
        checked ? toneClasses[tone] : "border-zani-border bg-surface-muted",
        sizing.track,
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "block rounded-full bg-white shadow-sm transition-transform duration-150",
          sizing.knob,
          checked ? sizing.translate : "translate-x-0",
        )}
      />
    </button>
  );
}

export function ToggleSwitch(props: SwitchProps) {
  return <Switch {...props} />;
}
