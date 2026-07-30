import assert from "node:assert/strict";
import test from "node:test";

import { uniqueById } from "../../src/features/dashboard/dashboardUtils.ts";

test("appointment queues keep first-seen order and remove duplicate ids", () => {
  const confirmation = { id: 7, source: "confirmation" };
  const merged = [
    confirmation,
    { id: 7, source: "confirmation-duplicate" },
    { id: 8, source: "upcoming" },
    { id: 9, source: "upcoming" },
    { id: 10, source: "upcoming" },
    { id: 11, source: "upcoming" },
  ];

  const visible = uniqueById(merged).slice(0, 4);

  assert.deepEqual(
    visible.map((item) => item.id),
    [7, 8, 9, 10],
  );
  assert.equal(visible[0], confirmation);
});
