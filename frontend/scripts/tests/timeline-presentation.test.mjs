import assert from "node:assert/strict";
import test from "node:test";
import {
  readTimelineFilters,
  safeTimelineMetadata,
  timelineDate,
  timelineDetailTransitions,
  timelineSummary,
  timelineEntityRoutes,
} from "../../src/features/timeline/timelinePresentation.ts";

test("URL filters retain search and normalize invalid pagination", () => {
  const filters = readTimelineFilters(
    new URLSearchParams(
      "search=Alice&category=task&actor=12&page=-5&page_size=999",
    ),
  );
  assert.deepEqual(filters, {
    search: "Alice",
    category: "task",
    actor: "12",
    date_from: "",
    date_to: "",
    page: 1,
    page_size: 20,
  });
  assert.equal(
    readTimelineFilters(new URLSearchParams("page=3&page_size=50")).page,
    3,
  );
});

test("metadata allowlist drops raw payloads, IDs, free text and non-finite values", () => {
  assert.deepEqual(
    safeTimelineMetadata({
      reason: "secret",
      source: "secret",
      token: "secret",
      entity_id: "123",
      provider: { secret: "value" },
      amount_before: Infinity,
      amount_after: "5000.00",
      from_status: "secret",
      to_status: "done",
      start_at: "2026-09-13T19:30:00Z",
      previous_start_at: "secret",
    }),
    {
      amount_after: "5000.00",
      start_at: "2026-09-13T19:30:00Z",
      to_status: "done",
    },
  );
});

test("business timezone is used consistently for day and clock", () => {
  assert.doesNotMatch(timelineDate("2026-09-13T19:30:00Z", "kk", "Asia/Almaty"), /M09/);
  assert.match(
    timelineDate("2026-09-13T19:30:00Z", "en", "Asia/Almaty"),
    /14 September 2026/,
  );
  assert.equal(
    timelineDate("2026-09-13T19:30:00Z", "en", "Asia/Almaty", true),
    "00:30",
  );
  assert.equal(timelineDate("invalid", "ru", "UTC"), "—");
  assert.doesNotThrow(() =>
    timelineDate("2026-09-13T19:30:00Z", "kk", "Invalid/Zone"),
  );
});

test("unknown event text cannot become merchant copy", () => {
  const t = (key) =>
    ({
      "timeline.otherEvent": "Event",
      "crmCard.timelineEvent.task_created": "Task created",
    })[key] || key;
  assert.equal(timelineSummary("provider_secret", t), "Event");
  assert.equal(timelineSummary("task_created", t), "Task created");
});

test("detail transitions localize status and business dates without technical fields", () => {
  const t = (key) =>
    ({ "status.new": "Новая", "status.done": "Готово" })[key] || key;
  const result = timelineDetailTransitions(
    {
      from_status: "new",
      to_status: "done",
      start_at: "2026-09-13T19:30:00Z",
      source: "secret",
    },
    "ru",
    "Asia/Almaty",
    t,
  );
  assert.equal(result[0].value, "Новая → Готово");
  assert.match(result[1].value, /14 сентября 2026.*00:30/);
  assert.doesNotMatch(JSON.stringify(result), /secret/);
  assert.equal(timelineEntityRoutes.connector, undefined);
});
