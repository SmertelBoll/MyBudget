import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";

// The device database (spec 4.1): screens read and write here; the network only syncs it.
//   entities: every record of every collection, as JSON (amounts of data per user are small)
//   outbox:   local changes not yet accepted by the server, in order
//   meta:     sync cursor, data epoch, whose data this is
const DB_NAME = "mybudget.db";

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS entities (
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (collection, id)
  );
  CREATE TABLE IF NOT EXISTS outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    op TEXT NOT NULL,
    data TEXT
  );
  CREATE INDEX IF NOT EXISTS outbox_record ON outbox (collection, id);
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

const migrate = async (db: SQLite.SQLiteDatabase) => {
  if (Platform.OS !== "web") await db.execAsync("PRAGMA journal_mode = WAL;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
  return db;
};

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDb = () => {
  opening ??= SQLite.openDatabaseAsync(DB_NAME).then(migrate);
  return opening;
};

// expo-sqlite has no exclusive transactions on web, and concurrent writes on one connection can interleave inside
// a transaction. Every write goes through this queue, so they never overlap.
let writeTail: Promise<unknown> = Promise.resolve();

export const serialWrite = <T,>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
  const run = writeTail.then(async () => fn(await getDb()));
  writeTail = run.catch(() => {});
  return run;
};
