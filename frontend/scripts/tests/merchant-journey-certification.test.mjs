import assert from "node:assert/strict";
import test from "node:test";

import { verifyMerchantJourneyCertification } from "../check-merchant-journey-certification.mjs";

test("all ten pilot merchant journeys have traceable browser, backend and persistence evidence", () => {
  const result = verifyMerchantJourneyCertification();

  assert.equal(result.journeys, 10);
  assert.equal(result.passing, 10);
});
