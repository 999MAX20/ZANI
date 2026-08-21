import { AlertCircle } from "lucide-react";

import type { AppError } from "../../api/appError";
import { useI18n } from "../../lib/i18n";

type FieldErrorSummaryProps = {
  error: AppError;
  fieldLabels?: Record<string, string>;
  onFieldSelect?: (field: string) => void;
};

export function FieldErrorSummary({ error, fieldLabels = {}, onFieldSelect }: FieldErrorSummaryProps) {
  const { t } = useI18n();
  const entries = Object.entries(error.fieldErrors).flatMap(([field, messages]) =>
    messages.map((message) => ({ field, label: fieldLabels[field], message })),
  );

  if (!entries.length) return null;

  return (
    <div
      data-testid="field-error-summary"
      role="alert"
      className="rounded-card border border-[rgba(194,65,12,0.2)] bg-[var(--zani-danger-soft)] p-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0 text-zani-danger" size={18} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zani-ink">{t("fallback.fields.title")}</p>
          <p className="mt-1 text-xs leading-5 text-zani-subtle">{t("fallback.fields.description")}</p>
          <ul className="mt-2 space-y-1.5 text-sm text-zani-danger">
            {entries.map(({ field, label, message }, index) => (
              <li key={`${field}-${index}`}>
                {onFieldSelect ? (
                  <button
                    type="button"
                    className="zani-focus-ring rounded-sm text-left font-semibold underline decoration-[rgba(194,65,12,0.35)] underline-offset-2 hover:decoration-current"
                    onClick={() => onFieldSelect(field)}
                  >
                    {label ? `${label}: ` : ""}{message}
                  </button>
                ) : (
                  <span><span className="font-semibold">{label ? `${label}: ` : ""}</span>{message}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
