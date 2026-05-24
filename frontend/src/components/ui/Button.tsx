import { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "ai";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
};

export function Button({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }: ButtonProps) {
  const { t } = useI18n();
  const variants = {
    primary: "bg-midnight text-white shadow-premium hover:-translate-y-0.5 hover:bg-slate-800",
    secondary: "border border-slate-200/80 bg-white/80 text-slate-800 shadow-sm hover:-translate-y-0.5 hover:bg-white",
    ghost: "text-slate-600 hover:bg-white/70 hover:text-slate-950",
    danger: "bg-red-600 text-white shadow-sm hover:-translate-y-0.5 hover:bg-red-700",
    ai: "bg-ai-gradient text-white shadow-glow hover:-translate-y-0.5",
  };
  const sizes = {
    sm: "min-h-9 rounded-xl px-3 py-1.5 text-xs",
    md: "min-h-10 rounded-2xl px-4 py-2 text-sm",
    lg: "min-h-12 rounded-2xl px-5 py-3 text-base",
    icon: "zani-touch-target rounded-full p-0",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? t("common.loading") : children}
    </button>
  );
}
