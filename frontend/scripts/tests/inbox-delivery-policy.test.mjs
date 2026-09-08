import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(frontendDir, relativePath), "utf8");
}

const inboxApi = read("src/api/inbox.ts");
const conversationsPage = read("src/features/conversations/ConversationsPage.tsx");
const deliveryDetails = read("src/features/conversations/components/MessageDeliveryDetails.tsx");
const messageBubble = read("src/features/conversations/components/MessageBubble.tsx");

test("outbound inbox requests carry idempotency keys", () => {
  assert.match(inboxApi, /function idempotencyConfig\(idempotencyKey\?: string\)/);
  assert.match(inboxApi, /"Idempotency-Key": normalizedKey/);
  assert.match(inboxApi, /sendMessage:[\s\S]*idempotencyKey\?/);
  assert.match(inboxApi, /retryMessage:[\s\S]*idempotencyKey\?/);
  assert.match(conversationsPage, /sendIdempotencyRef/);
  assert.match(conversationsPage, /createIdempotencyKey\(`inbox:retry:/);
});

test("delivery details normalize provider states and keep recovery out of the primary bubble", () => {
  for (const status of ["queued", "sending", "delivered", "delayed", "retrying", "failed"]) {
    assert.match(deliveryDetails, new RegExp(status));
  }
  assert.match(deliveryDetails, /canRetry/);
  assert.match(deliveryDetails, /data-testid="message-delivery-retry"/);
  assert.doesNotMatch(messageBubble, /retryMessage|retryDelivery|error_text/);
  assert.doesNotMatch(deliveryDetails, /message\.error_text/);
});
