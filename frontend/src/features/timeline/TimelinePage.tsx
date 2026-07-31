import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { Card, CardBody } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { unwrapList } from "../../api/client";
import { formatDateTime } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import { categoryConfig, formatTimelineEventText, groupTimeline } from "../../components/crm/drawers/timelineHelpers";
import type { ActivityEvent } from "../../types";

export function TimelinePage() {
  const { language, t } = useI18n();
  const { business } = useActiveBusiness();
  const { activityEvents, clients } = useEntityData({ activityEvents: true, clients: true });
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | ActivityEvent["category"]>("all");

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
  }, [searchParams]);

  if (!business) return <ErrorState message={t("timeline.noBusiness")} />;
  if (activityEvents.isLoading || clients.isLoading) return <LoadingState />;

  const clientList = unwrapList(clients.data);
  const rows = unwrapList(activityEvents.data).filter((event) => {
    const text = `${formatTimelineEventText(event, t)} ${event.text} ${clientList.find((item) => item.id === event.client)?.full_name || ""}`.toLowerCase();
    return (category === "all" || event.category === category) && (!search || text.includes(search.toLowerCase()));
  });
  const grouped = groupTimeline(rows, language);

  return (
    <>
      <PageHeader title={t("timeline.title")} description={t("timeline.description")} />
      <Card>
        <CardBody>
          <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="grid gap-1.5 text-sm font-semibold text-zani-subtle">
              {t("timeline.search")}
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("timeline.searchPlaceholder")}
                className="h-10 rounded-control border border-zani-border bg-surface-card px-3 text-zani-text outline-none focus:border-brand-300 focus:ring-4 focus:ring-[var(--zani-focus-ring)]"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-zani-subtle">
              {t("timeline.category")}
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as "all" | ActivityEvent["category"])}
                className="h-10 rounded-control border border-zani-border bg-surface-card px-3 text-zani-text outline-none focus:border-brand-300 focus:ring-4 focus:ring-[var(--zani-focus-ring)]"
              >
                <option value="all">{t("timeline.allCategories")}</option>
                {Object.entries(categoryConfig).map(([value, config]) => (
                  <option key={value} value={value}>{t(config.labelKey)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="space-y-5">
            {Object.entries(grouped).map(([date, events]) => (
              <section key={date} className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{date}</p>
                {events.map((event) => {
                  const client = clientList.find((item) => item.id === event.client);
                  const config = categoryConfig[event.category];
                  const Icon = config.icon;
                  return (
                    <div key={event.id} className="border-b border-zani-border py-3 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${config.iconClassName}`}>
                          <Icon size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-zani-ink">{formatTimelineEventText(event, t)}</p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${config.badgeClassName}`}>{t(config.labelKey)}</span>
                          </div>
                          <p className="mt-1 text-sm text-zani-muted">{client?.full_name || t("timeline.noClient")} · {formatDateTime(event.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
            {!rows.length ? (
              <div className="rounded-card border border-dashed border-zani-border bg-surface-muted p-6 text-center">
                <p className="font-bold text-midnight">{t("timeline.emptyTitle")}</p>
                <p className="mt-1 text-sm text-slate-500">{t("timeline.emptyText")}</p>
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
