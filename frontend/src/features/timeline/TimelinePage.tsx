import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useState } from "react";

import { activityEventsApi } from "../../api/activities";
import { normalizeAppError } from "../../api/appError";
import { getApiErrorMessage } from "../../api/client";
import { CrmPagination, CrmWorkspacePage } from "../../components/crm";
import { OperationalWorkspace } from "../../components/crm/OperationalWorkspace";
import { Button } from "../../components/ui/Button";
import { Surface } from "../../components/ui/Card";
import { ErrorState, ForbiddenState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import type { TimelineFilters } from "../../types/timeline";
import { useAuth } from "../auth/AuthProvider";
import { TimelineDetails } from "./TimelineDetails";
import { TimelineEventTable } from "./TimelineEventTable";
import { TimelineToolbar } from "./TimelineToolbar";
import { readTimelineFilters } from "./timelinePresentation";
import { useTimelineSearchParams } from "./useTimelineSearchParams";

export function TimelinePage() {
  const { t } = useI18n();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const [params, setParams] = useTimelineSearchParams();
  const filters = readTimelineFilters(params);
  const hasFilters = Boolean(
    filters.search ||
      filters.category ||
      filters.actor ||
      filters.date_from ||
      filters.date_to,
  );
  const selectedId = params.get("event");
  const debouncedSearch = useDebouncedValue(filters.search);
  const [focusRequest, setFocusRequest] = useState<number>();
  const titleId = useId();
  const canView = hasPermission(user, business?.id, "analytics");
  const query = useQuery({
    queryKey: [
      "activity-events",
      business?.id,
      { ...filters, search: debouncedSearch },
    ],
    queryFn: ({ signal }) =>
      activityEventsApi.listPage(
        business!.id,
        { ...filters, search: debouncedSearch },
        signal,
      ),
    enabled: Boolean(business && canView),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === business?.id
        ? keepPreviousData(previous)
        : undefined,
  });
  const rows = query.data?.results || [];
  const total = query.data?.count || 0;
  // Background refresh must not swallow clicks on the still-current result set.
  const busy =
    query.isPending ||
    query.isPlaceholderData ||
    filters.search !== debouncedSearch;
  const selected = !query.isError
    ? rows.find((row) => String(row.id) === selectedId)
    : undefined;
  const close = useCallback(() => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("event");
      return next;
    });
  }, [setParams]);
  useEffect(() => {
    if (
      selectedId &&
      query.isSuccess &&
      !busy &&
      !query.isPlaceholderData &&
      !selected
    ) {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("event");
          return next;
        },
        { replace: true },
      );
    }
  }, [
    selectedId,
    query.isSuccess,
    query.isPlaceholderData,
    busy,
    selected,
    setParams,
  ]);
  const changeFilter = (key: keyof TimelineFilters, value: string | number) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === "") next.delete(key);
        else next.set(key, String(value));
        if (key !== "page") next.set("page", "1");
        return next;
      },
      { replace: key === "search" },
    );
  };
  const reset = () => setParams({});
  if (!business) return <ErrorState message={t("timeline.noBusiness")} />;
  if (
    !canView ||
    (query.isError && normalizeAppError(query.error).category === "permission")
  )
    return <ForbiddenState />;
  const timeZone = business.timezone || "UTC";
  const from = total ? (filters.page - 1) * filters.page_size + 1 : 0;
  const to = Math.min(total, filters.page * filters.page_size);
  return (
    <CrmWorkspacePage
      maxWidthClassName="max-w-[1720px]"
      className="!min-h-0 !h-[calc(100dvh-10rem)] md:!h-[calc(100dvh-5.5rem)]"
      testId="timeline-workspace"
    >
      <OperationalWorkspace
        inspectorOpen={Boolean(selected)}
        inspectorTitleId={titleId}
        inspectorColumnClassName="2xl:grid-cols-[minmax(0,1fr)_clamp(340px,25vw,420px)]"
        focusReturnId={selectedId ? `timeline-event-${selectedId}` : undefined}
        focusInspectorRequestKey={focusRequest}
        onInspectorClose={close}
        main={
          <Surface
            padding="none"
            className="flex h-full min-h-0 flex-col overflow-hidden"
          >
            <TimelineToolbar
              businessId={business.id}
              filters={filters}
              onChange={changeFilter}
              onReset={reset}
            />
            {query.isError ? (
              <div className="p-4">
                <ErrorState
                  message={getApiErrorMessage(query.error)}
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => void query.refetch()}
                      >
                        {t("common.retry")}
                      </Button>
                      <Button variant="secondary" onClick={reset}>
                        {t("timeline.reset")}
                      </Button>
                    </div>
                  }
                />
              </div>
            ) : (
              <>
                <div
                  className="min-h-0 flex-1"
                  aria-busy={busy || query.isFetching}
                >
                  <TimelineEventTable
                    rows={rows}
                    selectedId={selected?.id}
                    timeZone={timeZone}
                    isLoading={query.isPending}
                    busy={busy}
                    hasFilters={hasFilters}
                    onReset={reset}
                    onSelect={(event, interaction) => {
                      if (
                        interaction.source === "keyboard" &&
                        interaction.key === "Enter"
                      )
                        setFocusRequest((value) => (value || 0) + 1);
                      setParams((current) => {
                        const next = new URLSearchParams(current);
                        next.set("event", String(event.id));
                        return next;
                      });
                    }}
                  />
                </div>
                <fieldset
                  disabled={busy}
                  className="min-w-0 shrink-0 [&_button]:min-h-11"
                >
                  <CrmPagination
                    variant="toolbar"
                    className="border-t border-zani-border px-3 py-3"
                    shown={rows.length}
                    total={total}
                    page={filters.page}
                    pageSize={filters.page_size}
                    rangeLabel={t("timeline.range", { from, to, total })}
                    previousLabel={t("pagination.previous")}
                    nextLabel={t("pagination.next")}
                    pageSizeAriaLabel={t("timeline.pageSize")}
                    pageSizeLabel={(size) =>
                      t("timeline.perPage", { count: size })
                    }
                    onPageChange={(page) => changeFilter("page", page)}
                    onPageSizeChange={(size) => changeFilter("page_size", size)}
                  />
                </fieldset>
              </>
            )}
          </Surface>
        }
        inspector={({ onClose }) =>
          selected ? (
            <TimelineDetails
              event={selected}
              titleId={titleId}
              timeZone={timeZone}
              canOpen={(resource) => hasPermission(user, business.id, resource)}
              onClose={onClose}
            />
          ) : null
        }
      />
    </CrmWorkspacePage>
  );
}
