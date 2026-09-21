import { ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { OperationalInspector } from "../../components/crm/OperationalWorkspace";
import { categoryConfig } from "../../components/crm/drawers/timelineHelpers";
import { useI18n } from "../../lib/i18n";
import type { TimelineEvent } from "../../types/timeline";
import {
  timelineDate,
  timelineDetailTransitions,
  timelineEntityRoutes,
  timelineSummary,
} from "./timelinePresentation";

export function TimelineEventLabel({ event }: { event: TimelineEvent }) {
  const { t } = useI18n();
  return <>{timelineSummary(event.event_type, t)}</>;
}

export function TimelineCategory({ event }: { event: TimelineEvent }) {
  const { t } = useI18n();
  const config = categoryConfig[event.category] || categoryConfig.system;
  return (
    <span
      className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ${config.badgeClassName}`}
    >
      {t(config.labelKey)}
    </span>
  );
}

export function TimelineDetails({
  event,
  titleId,
  timeZone,
  canOpen,
  onClose,
}: {
  event: TimelineEvent;
  titleId: string;
  timeZone: string;
  canOpen: (resource: string) => boolean;
  onClose: () => void;
}) {
  const { language, t } = useI18n();
  const details = timelineDetailTransitions(
    event.metadata || {},
    language,
    timeZone,
    t,
  );
  const entity = timelineEntityRoutes[event.entity_type.toLowerCase()];
  const entityHref =
    entity && /^[1-9]\d*$/.test(event.entity_id) && canOpen(entity.permission)
      ? `/app/${entity.path}/${event.entity_id}`
      : null;
  const clientHref =
    event.client && event.client_name && canOpen("clients")
      ? `/app/clients/${event.client}`
      : null;
  return (
    <div
      className="h-full min-h-0"
      onKeyDown={(key) => {
        if (key.key === "Escape") {
          key.stopPropagation();
          onClose();
        }
      }}
    >
      <OperationalInspector
        title={t("timeline.details")}
        titleId={titleId}
        onClose={onClose}
        testId="timeline-details"
      >
        <div className="space-y-5 break-words">
          <div className="space-y-2">
            <TimelineCategory event={event} />
            <p className="font-semibold text-zani-text">
              <TimelineEventLabel event={event} />
            </p>
            <p className="text-sm text-zani-subtle">
              {timelineDate(event.created_at, language, timeZone)} ·{" "}
              {timelineDate(event.created_at, language, timeZone, true)}
            </p>
          </div>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">
              {t("timeline.descriptionLabel")}
            </h3>
            {details.length ? (
              <dl className="space-y-3">
                {details.map((detail) => (
                  <div
                    key={detail.label}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-sm"
                  >
                    <dt className="text-zani-subtle">{detail.label}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-zani-subtle">
                {t("timeline.noDetails")}
              </p>
            )}
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("timeline.object")}</h3>
            {clientHref ? (
              <Link
                className="zani-focus-ring flex min-h-11 items-center justify-between gap-2 rounded-control border border-zani-border bg-surface-card px-3 py-2 text-sm"
                to={clientHref}
              >
                {event.client_name}
                <ExternalLink aria-hidden size={16} className="shrink-0" />
              </Link>
            ) : (
              <p className="text-sm text-zani-subtle">
                {event.client_name || t("timeline.noClient")}
              </p>
            )}
            {entityHref && entityHref !== clientHref && (
              <Link
                className="zani-focus-ring flex min-h-11 items-center justify-between gap-2 rounded-control border border-zani-border bg-surface-card px-3 py-2 text-sm"
                to={entityHref}
              >
                {t(entity.label)}
                <ExternalLink aria-hidden size={16} />
              </Link>
            )}
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("timeline.actor")}</h3>
            <p className="text-sm">
              {event.actor_name ||
                t(event.actor ? "timeline.unknownActor" : "timeline.noActor")}
            </p>
          </section>
        </div>
      </OperationalInspector>
    </div>
  );
}
