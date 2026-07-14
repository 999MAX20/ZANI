import { cn } from "../../../lib/cn";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { ActivityEvent, CrmCardPayload } from "../../../types";
import { drawerSurfaceClass, EmptyBlock } from "./shared";
import { categoryConfig, formatToken, groupTimeline, timelineDetails } from "./timelineHelpers";

function EventBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-bold", className)}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function TimelineEventItem({ event }: { event: ActivityEvent }) {
  const { t } = useI18n();
  const config = categoryConfig[event.category] || categoryConfig.system;
  const Icon = config.icon;
  const source = event.source ? formatToken(event.source) : t("crmCard.timelineCategoryCrm");
  const details = timelineDetails(event, t);

  return (
    <div className={drawerSurfaceClass}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-card", config.iconClassName)}>
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <EventBadge className={config.badgeClassName}>{t(config.labelKey)}</EventBadge>
            <EventBadge className="bg-slate-100 text-slate-600">{source}</EventBadge>
            <EventBadge className="bg-slate-100 text-slate-600">{formatToken(event.event_type)}</EventBadge>
          </div>
          <p className="mt-2 break-words text-sm font-bold leading-6 text-midnight">
            {event.text || formatToken(event.event_type)}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{formatDateTime(event.created_at)}</p>
          {details.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {details.map((detail) => (
                <div key={`${detail.label}-${detail.value}`} className="min-w-0 rounded-card border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase text-slate-400">{detail.label}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-700" title={detail.value}>
                    {detail.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function EntityTimelineList({ data }: { data: CrmCardPayload }) {
  const { language, t } = useI18n();
  const grouped = groupTimeline(data.timeline, language);
  const total = data.meta?.related_counts.timeline ?? data.timeline.length;
  const hasMore = Boolean(data.meta?.has_more.timeline);

  if (!data.timeline.length) {
    return <EmptyBlock title={t("crmCard.emptyTimeline")} text={t("crmCard.emptyTimelineText")} />;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-card border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
        {t("crmCard.timelineVisibleCount", { visible: data.timeline.length, total })}
        {hasMore ? <span className="ml-1 text-slate-500">{t("crmCard.timelineHasMore")}</span> : null}
      </div>
      {Object.entries(grouped).map(([date, events]) => (
        <div key={date} className="space-y-3">
          <p className="px-1 text-xs font-bold uppercase text-slate-400">{date}</p>
          {events.map((event) => (
            <TimelineEventItem key={event.id} event={event} />
          ))}
        </div>
      ))}
    </div>
  );
}
