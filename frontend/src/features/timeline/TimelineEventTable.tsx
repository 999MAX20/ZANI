import { categoryConfig } from "../../components/crm/drawers/timelineHelpers";
import {
  DataTable,
  type DataTableRowInteraction,
} from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { useI18n } from "../../lib/i18n";
import type { TimelineEvent } from "../../types/timeline";
import { TimelineCategory, TimelineEventLabel } from "./TimelineDetails";
import { timelineDate, timelineSummary } from "./timelinePresentation";

export function TimelineEventTable({
  rows,
  selectedId,
  timeZone,
  isLoading,
  busy,
  hasFilters,
  onReset,
  onSelect,
}: {
  rows: TimelineEvent[];
  selectedId?: TimelineEvent["id"];
  timeZone: string;
  isLoading: boolean;
  busy: boolean;
  hasFilters: boolean;
  onReset: () => void;
  onSelect: (
    event: TimelineEvent,
    interaction: DataTableRowInteraction,
  ) => void;
}) {
  const { language, t } = useI18n();
  return (
    <DataTable
      className="h-full !rounded-none !border-0 !shadow-none"
      hideFooter
      rows={rows}
      rowKey={(event) => event.id}
      isLoading={isLoading}
      selectedRowKey={selectedId}
      tableLabel={t("timeline.title")}
      rowAriaLabel={(event) =>
        `${t("timeline.openDetails")}: ${timelineSummary(event.event_type, t)}, ${event.client_name || t("timeline.noClient")}, ${timelineDate(event.created_at, language, timeZone, true)}`
      }
      rowFocusReturnId={(event) => `timeline-event-${event.id}`}
      rowTestId={(event) => `timeline-event-${event.id}`}
      rowGroup={(event) => timelineDate(event.created_at, language, timeZone)}
      onRowSelect={
        busy
          ? undefined
          : (event, _index, interaction) => onSelect(event, interaction)
      }
      emptyTitle={t(hasFilters ? "common.noResults" : "timeline.emptyTitle")}
      emptyDescription={t(
        hasFilters ? "timeline.emptyFilteredText" : "timeline.emptyText",
      )}
      emptyAction={
        hasFilters ? (
          <Button variant="secondary" onClick={onReset}>
            {t("timeline.reset")}
          </Button>
        ) : undefined
      }
      columns={[
        {
          header: t("timeline.event"),
          className: "!whitespace-normal",
          cell: (event) => {
            const config =
              categoryConfig[event.category] || categoryConfig.system;
            const Icon = config.icon;
            return (
              <div className="flex max-w-[360px] items-start gap-3">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-control ${config.iconClassName}`}
                >
                  <Icon aria-hidden size={17} />
                </span>
                <span className="min-w-0 break-words font-semibold text-zani-text">
                  <TimelineEventLabel event={event} />
                </span>
              </div>
            );
          },
        },
        {
          header: t("timeline.object"),
          cell: (event) => (
            <span
              className="block max-w-[200px] truncate"
              title={event.client_name}
            >
              {event.client_name || t("timeline.noClient")}
            </span>
          ),
        },
        {
          header: t("timeline.actor"),
          className: "min-w-[160px]",
          cell: (event) => (
            <span
              className="block max-w-[160px] truncate"
              title={event.actor_name}
            >
              {event.actor_name ||
                t(event.actor ? "timeline.unknownActor" : "timeline.noActor")}
            </span>
          ),
        },
        {
          header: t("timeline.time"),
          className: "min-w-20",
          cell: (event) => (
            <time
              dateTime={event.created_at}
              title={`${timelineDate(event.created_at, language, timeZone)} (${timeZone})`}
              className="tabular-nums"
            >
              {timelineDate(event.created_at, language, timeZone, true)}
            </time>
          ),
        },
        {
          header: t("timeline.category"),
          cell: (event) => <TimelineCategory event={event} />,
        },
      ]}
    />
  );
}
