import { InputHTMLAttributes, forwardRef } from "react";

import { cn } from "../../lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className, ...props }, ref) => (
  <label className="block">
    {label ? <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span> : null}
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-200 bg-white/85 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100",
        error && "border-red-300 focus:border-red-400 focus:ring-red-100",
        className,
      )}
      {...props}
    />
    {error ? <span className="mt-1 block text-sm text-red-600">{error}</span> : null}
  </label>
));

Input.displayName = "Input";
