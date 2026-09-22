import { Surface } from "../../components/ui/Card";
import { formatDateTime, formatMoney } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { FinancialReport } from "../../types";

const reasons = new Set([
  "no_source", "unsupported_source", "multiple_sources", "permission_denied",
  "source_unavailable", "initial_sync", "no_verified_snapshot", "sync_failed",
  "sync_stopped", "updating", "snapshot_not_refreshed", "sync_overdue",
]);

export function FinancialStatus({ report, compact = false }: { report?: FinancialReport; compact?: boolean }) {
  const { t } = useI18n();
  const reason = report?.reason && reasons.has(report.reason) ? report.reason : "source_unavailable";
  return (
    <span className={`block ${compact ? "space-y-0.5 text-[11px] leading-4" : "space-y-1 text-xs leading-5"}`} data-testid="financial-status">
      {report?.state !== "available" ? (
        <span className={`block ${report?.state === "stale" ? "font-semibold text-zani-warning" : "text-zani-subtle"}`}>
          {report?.state === "stale" ? `${t("finance.stale")} ` : ""}{t(`finance.reason.${reason}`)}
        </span>
      ) : null}
      {report?.source ? <span className="block break-words">{t("finance.source", { name: report.source.name })}</span> : null}
      {report ? <span className="block">{t("finance.period", { start: report.period.start, end: report.period.end })}</span> : null}
      {report?.last_successful_sync_at ? (
        <span className="block">{t("finance.asOf", { at: formatDateTime(report.last_successful_sync_at, undefined, true) })}</span>
      ) : null}
    </span>
  );
}

export function FinancialSummary({ report }: { report: FinancialReport }) {
  const { t } = useI18n();
  return (
    <Surface as="section" padding="lg" className="mt-6" data-testid="financial-summary">
      <h2 className="text-lg font-semibold text-zani-ink">{t("finance.title")}</h2>
      <div className="mt-3 text-zani-subtle"><FinancialStatus report={report} /></div>
      {report.state === "unavailable" ? (
        <p className="mt-3 font-semibold text-zani-subtle">{t("finance.unavailable")}</p>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          {(["receipts", "refunds", "net_receipts"] as const).map((key) => (
            <div key={key}>
              <dt className="text-sm text-zani-subtle">{t(`finance.${key}`)}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zani-ink">{formatMoney(report[key], report.currency)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Surface>
  );
}
