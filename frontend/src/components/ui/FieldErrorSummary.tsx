import type { AppError } from "../../api/appError";
import { useI18n } from "../../lib/i18n";
import { StatusNotice } from "./StatusNotice";

const technicalMessagePattern = /(?:sqlstate|traceback|stack\s*trace|exception|integrityerror|serializer|payload|undefined|null|api\s*key|webhook\s*signature|database|celery|redis|provider\s*sdk|(?:[a-z]:\\|\/(?:usr|var|home)\/))/i;

type FieldErrorSummaryProps = {
  error: AppError;
  fieldLabels?: Record<string, string>;
  onFieldSelect?: (field: string) => void;
};

export function FieldErrorSummary({ error, fieldLabels = {}, onFieldSelect }: FieldErrorSummaryProps) {
  const { t } = useI18n();
  const entries = Object.entries(error.fieldErrors).flatMap(([field, messages]) =>
    messages.map((message) => ({
      field,
      label: fieldLabels[field],
      message: technicalMessagePattern.test(message) ? t("fallback.fields.invalidValue") : message,
    })),
  );

  if (!entries.length) return null;

  return (
    <StatusNotice
      data-testid="field-error-summary"
      tone="danger"
      title={t("fallback.fields.title")}
      description={t("fallback.fields.description")}
      details={(
          <ul className="space-y-1.5 text-sm text-zani-danger">
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
      )}
    />
  );
}
