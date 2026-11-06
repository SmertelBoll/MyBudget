import { ApiError, api, isNetworkError } from "@/api/client";
import {
  applyRemote,
  countOutbox,
  dropOutbox,
  getMeta,
  onLocalChange,
  readOutbox,
  replaceFromServer,
  setMeta,
  wipeLocal,
  type RemoteChange,
} from "./store";
import { uploadPendingPhotos } from "./photos";
import type { Collection } from "./types";

// Spec 4.1: the outbox goes up in batches, then everything changed on the server since our cursor comes down.
// Runs on start, when the app returns to the foreground, every minute while open, and shortly after local edits.

const BATCH = 500;
const LOCAL_EDIT_DELAY_MS = 1500;

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

export type SyncState = {
  status: SyncStatus;
  pending: number;
  lastSyncedAt: string | null;
  errorCode: string | null;
};

let state: SyncState = { status: "idle", pending: 0, lastSyncedAt: null, errorCode: null };
const listeners = new Set<() => void>();

const setState = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

export const getSyncState = () => state;

export const subscribeSync = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

type PushResult = { collection: Collection; id: string; status: "applied" | "rejected"; code?: string };
type PullResponse =
  | { reset: true; epoch: number }
  | { reset: false; epoch: number; changes: RemoteChange[]; cursor: number; hasMore: boolean };

const readEpoch = async () => Number((await getMeta("epoch")) ?? 0);

// "Delete all data" on another device: local records and unsent changes belong to the old data set and are dropped.
const resetTo = async (epoch: number) => {
  await wipeLocal({ keepMeta: true });
  await setMeta({ epoch: String(epoch), cursor: "0" });
};

const push = async (rejected: { collection: Collection; id: string }[]) => {
  for (;;) {
    const rows = await readOutbox(BATCH);
    if (!rows.length) return;
    const changes = rows.map((row) => ({
      collection: row.collection,
      id: row.id,
      op: row.op,
      ...(row.op === "upsert" && row.data ? { data: JSON.parse(row.data) } : {}),
    }));

    let results: PushResult[];
    try {
      ({ results } = await api.post<{ results: PushResult[] }>("/sync/push", { epoch: await readEpoch(), changes }));
    } catch (error) {
      if (error instanceof ApiError && error.code === "sync.reset") {
        // The pull that follows learns the new epoch and starts over.
        await wipeLocal({ keepMeta: true });
        await setMeta({ cursor: "0" });
        return;
      }
      throw error;
    }

    // Results come back in the order sent. Rejected changes leave the queue too: retrying can't fix them.
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn("sync: rejected", result.collection, result.id, result.code);
        rejected.push(rows[index]);
      }
    });
    await dropOutbox(rows.map((row) => row.seq));
    setState({ pending: await countOutbox() });
  }
};

const pull = async () => {
  for (;;) {
    const since = Number((await getMeta("cursor")) ?? 0);
    const epoch = await readEpoch();
    const res = await api.get<PullResponse>(`/sync/pull?since=${since}&epoch=${epoch}&limit=${BATCH}`);
    if (res.reset) {
      await resetTo(res.epoch);
      continue;
    }
    await applyRemote(res.changes);
    await setMeta({ cursor: String(res.cursor) });
    if (!res.hasMore) return;
  }
};

// A rejected record may now differ from the server (e.g. a duplicate tag name): take the server's copy, or drop
// the local one if the server never accepted it.
const reconcile = async (rejected: { collection: Collection; id: string }[]) => {
  for (const { collection, id } of rejected) {
    try {
      const { item } = await api.get<{ item: Record<string, unknown> }>(`/${collection}/${id}`);
      const { id: _id, ...data } = item;
      await replaceFromServer(collection, id, data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) await replaceFromServer(collection, id, null);
    }
  }
};

const runOnce = async () => {
  setState({ status: "syncing", errorCode: null });
  try {
    const rejected: { collection: Collection; id: string }[] = [];
    // Photos first, so a transaction never reaches other devices pointing at a photo the server doesn't have.
    await uploadPendingPhotos();
    await push(rejected);
    await pull();
    await reconcile(rejected);
    const now = new Date().toISOString();
    await setMeta({ lastSyncedAt: now });
    setState({ status: "idle", lastSyncedAt: now, pending: await countOutbox() });
  } catch (error) {
    const offline = isNetworkError(error);
    setState({
      status: offline ? "offline" : "error",
      errorCode: error instanceof ApiError ? error.code : "common.serverError",
      pending: await countOutbox(),
    });
  }
};

let running: Promise<void> | null = null;
let again = false;

// Safe to call any time: while a sync runs, one more round is queued instead of a second sync in parallel.
export const requestSync = () => {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again && state.status === "idle");
  })().finally(() => {
    running = null;
  });
  return running;
};

let editTimer: ReturnType<typeof setTimeout> | null = null;

const afterLocalEdit = () => {
  countOutbox().then((pending) => setState({ pending }));
  if (editTimer) clearTimeout(editTimer);
  editTimer = setTimeout(() => {
    editTimer = null;
    requestSync();
  }, LOCAL_EDIT_DELAY_MS);
};

// Called by DataProvider once the local data belongs to the signed-in user.
export const startSync = async () => {
  onLocalChange(afterLocalEdit);
  setState({ lastSyncedAt: await getMeta("lastSyncedAt"), pending: await countOutbox() });
};

export const stopSync = () => {
  onLocalChange(null);
  if (editTimer) clearTimeout(editTimer);
};
