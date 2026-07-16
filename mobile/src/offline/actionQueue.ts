import AsyncStorage from "@react-native-async-storage/async-storage";

const OFFLINE_ACTION_QUEUE_KEY = "zani.mobile.offlineActionQueue.v1";
const MAX_QUEUE_SIZE = 50;

export type OfflineAction = {
  id: string;
  businessId: number;
  endpoint: string;
  method: "POST";
  idempotencyKey: string;
  body: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  maxAttempts?: number;
  conflict?: boolean;
  lastError?: string;
};

export type OfflineReplayResult = {
  replayed: number;
  failed: number;
  conflicted: number;
  remaining: number;
};

export async function enqueueOfflineAction(action: Omit<OfflineAction, "id" | "createdAt" | "attempts">) {
  const queue = await getOfflineActionQueue();
  const next: OfflineAction = {
    ...action,
    id: `${action.endpoint}:${action.idempotencyKey}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const deduped = queue.filter((item) => item.id !== next.id);
  deduped.unshift(next);
  await setOfflineActionQueue(deduped.slice(0, MAX_QUEUE_SIZE));
  return next;
}

export async function getOfflineActionQueue() {
  const raw = await AsyncStorage.getItem(OFFLINE_ACTION_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OfflineAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await AsyncStorage.removeItem(OFFLINE_ACTION_QUEUE_KEY);
    return [];
  }
}

export async function setOfflineActionQueue(queue: OfflineAction[]) {
  await AsyncStorage.setItem(OFFLINE_ACTION_QUEUE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE_SIZE)));
}

export async function removeOfflineAction(actionId: string) {
  const queue = await getOfflineActionQueue();
  await setOfflineActionQueue(queue.filter((item) => item.id !== actionId));
}

export async function clearOfflineActionQueue() {
  await AsyncStorage.removeItem(OFFLINE_ACTION_QUEUE_KEY);
}

export async function replayOfflineActionQueue(
  request: (action: OfflineAction) => Promise<unknown>,
): Promise<OfflineReplayResult> {
  const queue = await getOfflineActionQueue();
  const remaining: OfflineAction[] = [];
  let replayed = 0;
  let failed = 0;
  let conflicted = 0;

  for (const action of queue) {
    if (action.conflict) {
      conflicted += 1;
      remaining.push(action);
      continue;
    }
    try {
      await request(action);
      replayed += 1;
    } catch (error) {
      const attempts = action.attempts + 1;
      const next: OfflineAction = {
        ...action,
        attempts,
        conflict: isConflictError(error),
        lastError: error instanceof Error ? error.message : "Replay failed.",
      };
      if (next.conflict) {
        conflicted += 1;
        remaining.push(next);
      } else if (attempts < (action.maxAttempts || 5)) {
        failed += 1;
        remaining.push(next);
      } else {
        conflicted += 1;
        remaining.push({ ...next, conflict: true });
      }
    }
  }

  await setOfflineActionQueue(remaining);
  return { replayed, failed, conflicted, remaining: remaining.length };
}

function isConflictError(error: unknown) {
  return Boolean(error && typeof error === "object" && "status" in error && [400, 404, 409, 422].includes(Number((error as { status?: unknown }).status)));
}
