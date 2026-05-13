import { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "ai";
  isLoading?: boolean;
};

export function Button({ className, variant = "primary", isLoading, children, disabled, ...props }: ButtonProps) {
  const variants = {
    primary: "bg-midnight text-white shadow-premium hover:-translate-y-0.5 hover:bg-slate-800",
    secondary: "border border-slate-200/80 bg-white/80 text-slate-800 shadow-sm hover:-translate-y-0.5 hover:bg-white",
    ghost: "text-slate-600 hover:bg-white/70 hover:text-slate-950",
    danger: "bg-red-600 text-white shadow-sm hover:-translate-y-0.5 hover:bg-red-700",
    ai: "bg-ai-gradient text-white shadow-glow hover:-translate-y-0.5",
  };

  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? "Загрузка..." : children}
    </button>
  );
}
