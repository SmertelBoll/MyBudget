import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { api } from "@/api/client";
import type { User } from "@/api/types";
import { fileDate } from "@/utils/files";
import { buildXlsx, XLSX_MIME, type Cell } from "@/utils/xlsx";
import { resetBalanceCache } from "./balances";
import { categoryName } from "./categories";
import { deleteLocalPhotoFiles, photoBytes, storePhotoBytes } from "./photos";
import { getSnapshot, loadAll, setMeta, wipeLocal } from "./store";
import { requestSync } from "./sync";
import { COLLECTIONS, type Collection, type EntityMap, type Transaction, type Transfer } from "./types";

// Settings -> Data and storage (spec 13.4).

export const BACKUP_SCHEMA_VERSION = 1;
const PHOTO_DIR = "photos/";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const decimal = (minor: number) => minor / 100;

// ---- Excel ------------------------------------------------------------------------------------------------------

const lookups = (t: Translate) => {
  const accounts = new Map(getSnapshot("accounts").map((account) => [account.id, account]));
  const categories = new Map(getSnapshot("categories").map((category) => [category.id, categoryName(category, t)]));
  const tags = new Map(getSnapshot("tags").map((tag) => [tag.id, tag.name]));
  return { accounts, categories, tags };
};

const byDate = <T extends { date: string; clientCreatedAt: string }>(items: T[]) =>
  [...items].sort((a, b) => a.date.localeCompare(b.date) || a.clientCreatedAt.localeCompare(b.clientCreatedAt));

export const transferRows = (transfers: Transfer[], t: Translate): Cell[][] => {
  const { accounts } = lookups(t);
  const header = [t("export.date"), t("export.from"), t("export.amountFrom"), t("export.currency"), t("export.to"), t("export.amountTo"), t("export.currency"), t("export.rate"), t("export.comment")];
  return [
    header,
    ...byDate(transfers).map((transfer) => {
      const from = accounts.get(transfer.fromAccountId);
      const to = accounts.get(transfer.toAccountId);
      return [
        transfer.date,
        from?.name ?? "",
        decimal(transfer.amountFrom),
        from?.currency ?? "",
        to?.name ?? "",
        decimal(transfer.amountTo),
        to?.currency ?? "",
        transfer.rate,
        transfer.comment,
      ];
    }),
  ];
};

export const TRANSFER_WIDTHS = [12, 20, 14, 9, 20, 14, 9, 10, 30];

// Three sheets: expenses, income, transfers; every field, both amounts and the rate (spec 13.4). Photos are listed
// by id: a link to a private photo would stop working within the hour.
// The file only; the screen decides where it goes (saved on the device or shared).
export type OutputFile = { name: string; bytes: Uint8Array; mimeType: string };

export const exportToExcel = (t: Translate): OutputFile => {
  const { accounts, categories, tags } = lookups(t);
  const transactions = getSnapshot("transactions");
  const header = [
    t("export.date"),
    t("export.account"),
    t("export.category"),
    t("export.tags"),
    t("export.amount"),
    t("export.currency"),
    t("export.accountAmount"),
    t("export.accountCurrency"),
    t("export.rate"),
    t("export.comment"),
    t("export.photos"),
  ];
  const rows = (type: Transaction["type"]): Cell[][] => [
    header,
    ...byDate(transactions.filter((tx) => tx.type === type)).map((tx) => {
      const account = accounts.get(tx.accountId);
      return [
        tx.date,
        account?.name ?? "",
        categories.get(tx.categoryId) ?? "",
        tx.tagIds.map((id) => tags.get(id)).filter(Boolean).join(", "),
        decimal(tx.amount),
        tx.currency,
        decimal(tx.accountAmount),
        account?.currency ?? "",
        tx.rate,
        tx.comment,
        tx.photos.join(", "),
      ];
    }),
  ];
  const widths = [12, 20, 20, 24, 14, 9, 14, 9, 10, 30, 20];
  const bytes = buildXlsx([
    { name: t("entries.expenses"), rows: rows("expense"), widths },
    { name: t("entries.income"), rows: rows("income"), widths },
    { name: t("export.transfers"), rows: transferRows(getSnapshot("transfers"), t), widths: TRANSFER_WIDTHS },
  ]);
  return { name: `MyBudget-${fileDate()}.xlsx`, bytes, mimeType: XLSX_MIME };
};

// ---- Backup -----------------------------------------------------------------------------------------------------

type BackupFile = {
  app: "MyBudget";
  schemaVersion: number;
  createdAt: string;
  baseCurrency: string | null;
  settings: User["settings"];
  collections: { [C in Collection]: EntityMap[C][] };
};

// A ZIP with data.json (with the schema version) and a photos folder (spec 13.4). Works offline; photos that only
// live on the server are downloaded when there's a connection. Returns how many photos couldn't be included.
export const createBackup = async (user: User): Promise<OutputFile & { missing: number }> => {
  const collections = Object.fromEntries(COLLECTIONS.map((name) => [name, getSnapshot(name)])) as BackupFile["collections"];
  const data: BackupFile = {
    app: "MyBudget",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    baseCurrency: user.baseCurrency,
    settings: user.settings,
    collections,
  };
  const files: Zippable = { "data.json": strToU8(JSON.stringify(data, null, 1)) };
  const photoIds = [...new Set(collections.transactions.flatMap((tx) => tx.photos))];
  let missing = 0;
  for (const id of photoIds) {
    const bytes = await photoBytes(id);
    if (bytes) files[`${PHOTO_DIR}${id}.jpg`] = [bytes, { level: 0 }];
    else missing += 1;
  }
  return { name: `MyBudget-backup-${fileDate()}.zip`, bytes: zipSync(files, { level: 6 }), mimeType: "application/zip", missing };
};

export class BackupFileError extends Error {}

// Reads and checks a backup before anything is sent: the server checks every record again.
// Takes the ZIP as made, a ZIP someone repacked (data.json inside a folder), or data.json on its own (then without
// photos).
export const readBackup = (bytes: Uint8Array) => {
  let entries: Record<string, Uint8Array>;
  // "{" (after an optional UTF-8 BOM and whitespace): a plain JSON file.
  const start = bytes.findIndex((byte) => byte !== 0xef && byte !== 0xbb && byte !== 0xbf && byte !== 0x20 && byte !== 0x0a && byte !== 0x0d && byte !== 0x09);
  if (bytes[start] === 0x7b) {
    entries = { "data.json": bytes.subarray(start) };
  } else {
    try {
      entries = unzipSync(bytes);
    } catch {
      throw new BackupFileError("backup.notZip");
    }
  }
  const dataPath = Object.keys(entries).find((path) => path === "data.json" || path.endsWith("/data.json"));
  const json = dataPath ? entries[dataPath] : undefined;
  if (!json) throw new BackupFileError("backup.noData");
  const root = dataPath!.slice(0, -"data.json".length);
  let data: BackupFile;
  try {
    data = JSON.parse(strFromU8(json));
  } catch {
    throw new BackupFileError("backup.noData");
  }
  if (data?.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new BackupFileError("backup.version");
  if (!data.collections || typeof data.collections !== "object") throw new BackupFileError("backup.noData");
  const photos = Object.entries(entries)
    .filter(([path]) => path.startsWith(root + PHOTO_DIR) && path.endsWith(".jpg"))
    .map(([path, content]) => ({ id: path.slice(root.length + PHOTO_DIR.length, -4), bytes: content }));
  const count = Object.values(data.collections).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
  return { data, photos, count, transactions: data.collections.transactions?.length ?? 0, createdAt: data.createdAt };
};

// Online only: the server replaces the account's records in one go, then this device starts over from it.
export const restoreBackup = async (backup: ReturnType<typeof readBackup>, step: (label: string) => void = () => {}) => {
  const { data, photos } = backup;
  step("send");
  const { user, photoIds } = await api.post<{ user: User; photoIds: Record<string, string> }>("/data/restore", {
    schemaVersion: data.schemaVersion,
    collections: data.collections,
    settings: data.settings,
    baseCurrency: data.baseCurrency,
  });
  step("local");
  await startOver(user);
  step("photos");
  for (const photo of photos) await storePhotoBytes(photoIds[photo.id] ?? photo.id, photo.bytes);
  requestSync();
  return user;
};

// The local copy is dropped and downloaded again under the server's new data epoch.
const startOver = async (user: User) => {
  await wipeLocal({ keepMeta: true });
  deleteLocalPhotoFiles();
  await setMeta({ epoch: String(user.dataEpoch), cursor: "0" });
};

// ---- Delete all data, recalculate -------------------------------------------------------------------------------

// Online only. Accounts, entries, transfers, tags, payments, reminders and photos go; categories are back to the
// defaults; the account and settings stay (spec 13.4).
export const deleteAllData = async () => {
  const { user } = await api.del<{ user: User }>("/data/all");
  await startOver(user);
  requestSync();
  return user;
};

// Spec 5.4. Balances are never stored here: they're always worked out from each account's anchor and its entries.
// "Recalculate" reads everything from the device's database again and works the balances out from scratch, then
// syncs, so the result also includes what other devices added.
export const recalculateBalances = async () => {
  resetBalanceCache();
  await loadAll();
  await requestSync();
};
