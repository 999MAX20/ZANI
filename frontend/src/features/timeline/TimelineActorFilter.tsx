import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { activityEventsApi } from "../../api/activities";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useI18n } from "../../lib/i18n";
import type { Id } from "../../types";

export function TimelineActorFilter({
  businessId,
  value,
  onChange,
}: {
  businessId: Id;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(search);
  const actors = useQuery({
    queryKey: ["timeline-actors", businessId, query, page, value],
    queryFn: ({ signal }) =>
      activityEventsApi.actors(businessId, query, page, value, signal),
    enabled: open || Boolean(value && value !== "none"),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === businessId
        ? keepPreviousData(previous)
        : undefined,
  });
  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };
  const changing =
    actors.isPending || actors.isPlaceholderData || search !== query;
  const selectedName =
    value === "none"
      ? t("timeline.noActor")
      : actors.data?.selected_actor?.name || t("timeline.actorSelected");
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        aria-label={`${t("timeline.actor")}: ${value ? selectedName : t("timeline.allActors")}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full min-w-0 !justify-start"
        onClick={() => {
          setSearch("");
          setPage(1);
          setOpen(true);
        }}
      >
        <span className="truncate">
          {value ? selectedName : t("timeline.allActors")}
        </span>
      </Button>
      <Modal
        title={t("timeline.actor")}
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        testId="timeline-actor-picker"
      >
        <div className="space-y-3">
          <Input
            aria-label={t("timeline.actorSearch")}
            placeholder={t("timeline.actorSearch")}
            value={search}
            maxLength={160}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => select("")}
            >
              {t("timeline.allActors")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => select("none")}
            >
              {t("timeline.noActor")}
            </Button>
          </div>
          {actors.isError ? (
            <ErrorState
              message={getApiErrorMessage(actors.error)}
              action={
                <Button
                  variant="secondary"
                  onClick={() => void actors.refetch()}
                >
                  {t("common.retry")}
                </Button>
              }
            />
          ) : actors.isPending ? (
            <LoadingState />
          ) : (
            <>
              <ul
                className="max-h-[40dvh] divide-y divide-zani-border overflow-y-auto"
                aria-busy={actors.isFetching}
              >
                {actors.data.results.map((actor) => (
                  <li key={actor.id}>
                    <button
                      type="button"
                      disabled={changing}
                      aria-pressed={value === String(actor.id)}
                      className="zani-focus-ring min-h-11 w-full break-words rounded-control px-3 py-2 text-left hover:bg-surface-muted"
                      onClick={() => select(String(actor.id))}
                    >
                      {actor.name || t("timeline.unknownActor")}
                    </button>
                  </li>
                ))}
              </ul>
              {!actors.data.results.length && (
                <p className="text-sm text-zani-subtle">
                  {t("timeline.noActorsFound")}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  disabled={!actors.data.previous || changing}
                  onClick={() => setPage(page - 1)}
                >
                  {t("pagination.previous")}
                </Button>
                <span className="text-sm tabular-nums">
                  {page}/{Math.max(1, Math.ceil(actors.data.count / 20))}
                </span>
                <Button
                  variant="secondary"
                  disabled={!actors.data.next || changing}
                  onClick={() => setPage(page + 1)}
                >
                  {t("pagination.next")}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
