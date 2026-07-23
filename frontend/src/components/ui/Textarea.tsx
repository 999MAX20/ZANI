import { TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "../../lib/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <label className="block">
      {label ? <span className="mb-2 block text-sm font-semibold text-zani-subtle">{label}</span> : null}
      <textarea
        ref={ref}
        className={cn(
          "zani-focus-ring min-h-24 w-full resize-y rounded-control border border-zani-border bg-surface-card px-3 py-2.5 text-sm font-medium leading-6 text-zani-text shadow-sm placeholder:text-zani-faint",
          "hover:border-brand-100 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-zani-faint read-only:bg-surface-warm read-only:text-zani-subtle",
          error && "border-zani-danger focus-visible:border-zani-danger focus-visible:ring-[rgba(194,65,12,0.18)]",
          className,
        )}
        {...props}
      />
      {error ? <span className="mt-1.5 block text-xs font-semibold text-zani-danger">{error}</span> : null}
    </label>
  ),
);

Textarea.displayName = "Textarea";
