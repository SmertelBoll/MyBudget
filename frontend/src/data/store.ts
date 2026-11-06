import { getDb, serialWrite } from "./db";
import { COLLECTIONS, type Collection, type EntityMap } from "./types";

// In-memory mirror of the `entities` table. Screens read from it synchronously (useCollection), so lists and
// statistics never wait for the database; every write goes to SQLite first, then here.

type AnyEntity = EntityMap[Collection];
type Listener = () => void;

const records = new Map<Collection, Map<string, AnyEntity>>(COLLECTIONS.map((name) => [name, new Map()]));
// Arrays handed to React: replaced (not mutated) on change, so useSyncExternalStore sees a new value.
const snapshots = new Map<Collection, AnyEntity[]>(COLLECTIONS.map((name) => [name, []]));
const listeners = new Set<Listener>();
let changeListener: (() => void) | null = null;

const refresh = (changed: Iterable<Collection>) => {
  for (const name of new Set(changed)) {
    snapshots.set(name, [...records.get(name)!.values()]);
  }
  listeners.forEach((listener) => listener());
};

export const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSnapshot = <C extends Collection>(collection: C) => snapshots.get(collection) as EntityMap[C][];

export const getRecord = <C extends Collection>(collection: C, id: string) =>
  records.get(collection)!.get(id) as EntityMap[C] | undefined;

// The sync engine registers here to be told about local writes.
export const onLocalChange = (listener: (() => void) | null) => {
  changeListener = listener;
};

export const loadAll = async () => {
  const db = await getDb();
  const rows = await db.getAllAsync<{ collection: Collection; id: string; data: string }>(
    "SELECT collection, id, data FROM entities"
  );
  COLLECTIONS.forEach((name) => records.get(name)!.clear());
  for (const row of rows) {
    records.get(row.collection)?.set(row.id, { ...JSON.parse(row.data), id: row.id });
  }
  refresh(COLLECTIONS);
};

const toRow = (entity: AnyEntity) => {
  const { id, ...data } = entity;
  return { id, json: JSON.stringify(data) };
};

// Local create/edit (spec 4.1): saved on the device at once, queued for the server. An earlier unsent edit of the
// same record is replaced, so only the latest version is sent.
export const saveEntity = async <C extends Collection>(collection: C, entity: EntityMap[C]) => {
  const { id, json } = toRow(entity);
  await serialWrite((db) =>
    db.withTransactionAsync(async () => {
      await db.runAsync("INSERT OR REPLACE INTO entities (collection, id, data) VALUES (?, ?, ?)", collection, id, json);
      await db.runAsync("DELETE FROM outbox WHERE collection = ? AND id = ? AND op = 'upsert'", collection, id);
      await db.runAsync("INSERT INTO outbox (collection, id, op, data) VALUES (?, ?, 'upsert', ?)", collection, id, json);
    })
  );
  records.get(collection)!.set(id, entity);
  refresh([collection]);
  changeListener?.();
};

export const removeEntity = async (collection: Collection, id: string) => {
  await serialWrite((db) =>
    db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM entities WHERE collection = ? AND id = ?", collection, id);
      await db.runAsync("DELETE FROM outbox WHERE collection = ? AND id = ?", collection, id);
      await db.runAsync("INSERT INTO outbox (collection, id, op) VALUES (?, ?, 'delete')", collection, id);
    })
  );
  records.get(collection)!.delete(id);
  refresh([collection]);
  changeListener?.();
};

export type RemoteChange = {
  collection: Collection;
  id: string;
  deleted: boolean;
  data?: Record<string, unknown>;
};

// Changes from /sync/pull. A record with an unsent local edit is skipped: the local version goes up on the next
// push and comes back from the server after that.
export const applyRemote = async (changes: RemoteChange[]) => {
  if (!changes.length) return;
  const touched: Collection[] = [];

  await serialWrite(async (db) => {
    const pending = new Set(
      (await db.getAllAsync<{ collection: string; id: string }>("SELECT collection, id FROM outbox")).map(
        (row) => `${row.collection}/${row.id}`
      )
    );
    await db.withTransactionAsync(async () => {
      for (const change of changes) {
        if (!records.has(change.collection) || pending.has(`${change.collection}/${change.id}`)) continue;
        if (change.deleted) {
          await db.runAsync("DELETE FROM entities WHERE collection = ? AND id = ?", change.collection, change.id);
        } else {
          await db.runAsync(
            "INSERT OR REPLACE INTO entities (collection, id, data) VALUES (?, ?, ?)",
            change.collection,
            change.id,
            JSON.stringify(change.data ?? {})
          );
        }
        touched.push(change.collection);
      }
    });
  });

  for (const change of changes) {
    if (!touched.includes(change.collection)) continue;
    const map = records.get(change.collection)!;
    if (change.deleted) map.delete(change.id);
    else map.set(change.id, { ...(change.data as object), id: change.id } as AnyEntity);
  }
  refresh(touched);
};

// Replaces one record with the server's copy, or drops it when the server has none (after a rejected change).
export const replaceFromServer = async (collection: Collection, id: string, data: Record<string, unknown> | null) => {
  await serialWrite((db) =>
    data
      ? db.runAsync("INSERT OR REPLACE INTO entities (collection, id, data) VALUES (?, ?, ?)", collection, id, JSON.stringify(data))
      : db.runAsync("DELETE FROM entities WHERE collection = ? AND id = ?", collection, id)
  );
  if (data) records.get(collection)!.set(id, { ...(data as object), id } as AnyEntity);
  else records.get(collection)!.delete(id);
  refresh([collection]);
};

// --- outbox -------------------------------------------------------------------------------------------------------

export type OutboxRow = { seq: number; collection: Collection; id: string; op: "upsert" | "delete"; data: string | null };

export const readOutbox = async (limit: number) =>
  (await getDb()).getAllAsync<OutboxRow>("SELECT seq, collection, id, op, data FROM outbox ORDER BY seq LIMIT ?", limit);

export const countOutbox = async () =>
  (await (await getDb()).getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox"))?.n ?? 0;

export const dropOutbox = (seqs: number[]) =>
  serialWrite(async (db) => {
    if (!seqs.length) return;
    await db.runAsync(`DELETE FROM outbox WHERE seq IN (${seqs.map(() => "?").join(",")})`, ...seqs);
  });

// --- meta ---------------------------------------------------------------------------------------------------------

export const getMeta = async (key: string) =>
  (await (await getDb()).getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", key))?.value ?? null;

export const setMeta = (values: Record<string, string>) =>
  serialWrite((db) =>
    db.withTransactionAsync(async () => {
      for (const [key, value] of Object.entries(values)) {
        await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", key, value);
      }
    })
  );

// Clears the records and the queue. `keepMeta` keeps whose data it was (used after "delete all data" elsewhere).
export const wipeLocal = async ({ keepMeta = false } = {}) => {
  await serialWrite((db) =>
    db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM entities");
      await db.runAsync("DELETE FROM outbox");
      if (!keepMeta) await db.runAsync("DELETE FROM meta");
    })
  );
  COLLECTIONS.forEach((name) => records.get(name)!.clear());
  refresh(COLLECTIONS);
};
