import { Card, CardBody } from "../../../components/ui/Card";
import type { EntitlementSummaryItem, UsageSummaryItem } from "../../../types";
import type { Translate } from "../settingsUtils";

type UsageSectionProps = {
  className: string;
  formatMetric: (metric: string, t: Translate) => string;
  isLoading: boolean;
  items: Array<EntitlementSummaryItem | UsageSummaryItem>;
  t: Translate;
};

export function UsageSection({ className, formatMetric, isLoading, items, t }: UsageSectionProps) {
  return (
    <Card id="usage" className={className}>
      <CardBody>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.usageEyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.usageTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {t("settings.usageText")}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {items.map((item) => {
            const percent = item.limit ? Math.min(100, Math.round((item.value / item.limit) * 100)) : 0;
            return (
              <div key={item.metric} className="rounded-card bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{formatMetric(item.metric, t)}</p>
                <p className="mt-2 text-2xl font-black text-midnight">
                  {item.value}
                  <span className="text-sm font-semibold text-slate-400"> / {item.limit ?? "в€ћ"}</span>
                </p>
                <div className="mt-3 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-ai-gradient" style={{ width: `${item.limit ? percent : 8}%` }} />
                </div>
                {item.is_over_limit ? <p className="mt-2 text-xs font-semibold text-red-600">{t("settings.limitReached")}</p> : null}
                {"remaining" in item && item.remaining !== null ? <p className="mt-2 text-xs font-semibold text-slate-500">{t("settings.remaining", { count: item.remaining })}</p> : null}
              </div>
            );
          })}
          {!isLoading && !items.length ? (
            <p className="text-sm text-slate-500">{t("settings.noUsage")}</p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
