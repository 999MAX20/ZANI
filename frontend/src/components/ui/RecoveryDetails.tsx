import { Check, Copy } from "lucide-react";
import { useState } from "react";

import type { AppError } from "../../api/appError";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

export function RecoveryDetails({ error, className }: { error: AppError; className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!error.requestId) return null;

  return (
    <details
      data-testid="recovery-details"
      className={cn("rounded-control border border-zani-border bg-surface-card px-3 py-2 text-xs text-zani-subtle", className)}
    >
      <summary className="zani-focus-ring cursor-pointer rounded-sm font-semibold text-zani-text">
        {t("fallback.recovery.summary")}
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zani-border pt-2">
        <span>{t("fallback.recovery.requestId")}</span>
        <code className="max-w-full overflow-hidden text-ellipsis rounded bg-surface-muted px-2 py-1 font-mono text-[11px] text-zani-text">
          {error.requestId}
        </code>
        <button
          type="button"
          className="zani-focus-ring ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-control px-2 font-semibold text-brand-700 hover:bg-brand-50"
          aria-label={t("fallback.recovery.copy")}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(error.requestId!);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2_000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
          {copied ? t("fallback.recovery.copied") : t("fallback.recovery.copy")}
        </button>
      </div>
    </details>
  );
}
