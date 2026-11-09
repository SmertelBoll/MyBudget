import crypto from "crypto";
import UserModel from "../models/user.js";
import PhotoModel from "../models/photo.js";
import { entitySchemas } from "../validations/entities.js";
import { settingsSchema } from "../validations/me.js";
import { currency } from "../validations/common.js";
import { AppError } from "./AppError.js";
import { SYNCED_MODELS, reserveSeq } from "./syncEngine.js";
import { withUserLock } from "./userLock.js";

// Spec 13.4 "Restore a backup". The client unpacks the ZIP and sends data.json; the photos inside it go up through
// the normal photo upload afterwards. Every account record is replaced, all or nothing.
export const BACKUP_SCHEMA_VERSION = 1;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const invalid = (path, message) => new AppError(400, "backup.invalid", [{ path, message }]);

// Checks the whole file before anything is written: one bad record and nothing changes.
const parseCollections = (collections) => {
  if (!collections || typeof collections !== "object") throw invalid("collections", "missing");
  const result = {};
  for (const [collection, schema] of Object.entries(entitySchemas)) {
    const items = collections[collection] ?? [];
    if (!Array.isArray(items)) throw invalid(collection, "not a list");
    const seen = new Set();
    result[collection] = items.map((item, index) => {
      const id = item?.id;
      if (typeof id !== "string" || !ID_PATTERN.test(id) || seen.has(id)) throw invalid(`${collection}.${index}.id`, "bad or repeated id");
      seen.add(id);
      const parsed = schema.safeParse(item);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw invalid(`${collection}.${index}.${issue.path.join(".")}`, issue.message);
      }
      const data = { ...parsed.data };
      if (collection === "categories") data.isSystemOther = item.isSystemOther === true;
      if (collection === "tags") data.nameLower = data.name.toLowerCase();
      return { id, data };
    });
  }

  const tagNames = new Set();
  for (const { data } of result.tags) {
    if (tagNames.has(data.nameLower)) throw invalid("tags", `repeated name "${data.name}"`);
    tagNames.add(data.nameLower);
  }
  // Subtags hang off top-level tags in the same backup; any other parent is dropped.
  const topLevel = new Set(result.tags.filter(({ data }) => !data.parentId).map(({ id }) => id));
  for (const { data } of result.tags) if (data.parentId && !topLevel.has(data.parentId)) data.parentId = null;
  // Exactly one "Other" per type: it's where entries of deleted categories go.
  for (const type of ["expense", "income"]) {
    const others = result.categories.filter(({ data }) => data.type === type && data.isSystemOther);
    others.slice(1).forEach(({ data }) => (data.isSystemOther = false));
    if (!others.length) {
      result.categories.push({
        id: crypto.randomUUID(),
        data: { name: null, nameKey: "category.other", type, icon: "dots-horizontal", color: "#9e9e9e", plannedMonthly: null, sortOrder: 999, isSystemOther: true },
      });
    }
  }
  return result;
};

// Ids are global keys. A backup of another account restored here could carry ids that account still uses: those
// records (and photos) get new ids, and every reference to them follows.
const remapForeignIds = async (userId, parsed) => {
  const map = new Map();
  for (const [collection, Model] of Object.entries(SYNCED_MODELS)) {
    const ids = parsed[collection].map((item) => item.id);
    const taken = await Model.find({ _id: { $in: ids }, userId: { $ne: userId } }).select("_id").lean();
    taken.forEach((doc) => map.set(String(doc._id), crypto.randomUUID()));
  }
  const photoIds = [...new Set(parsed.transactions.flatMap(({ data }) => data.photos))];
  const takenPhotos = await PhotoModel.find({ _id: { $in: photoIds }, userId: { $ne: userId } }).select("_id").lean();
  const photoMap = new Map(takenPhotos.map((doc) => [String(doc._id), crypto.randomUUID()]));
  if (!map.size && !photoMap.size) return { photoMap };

  const to = (id) => (id && map.get(id)) || id;
  for (const collection of Object.keys(SYNCED_MODELS)) {
    for (const item of parsed[collection]) {
      item.id = to(item.id);
      const { data } = item;
      for (const key of ["accountId", "categoryId", "fromAccountId", "toAccountId", "recurringId", "parentId"]) {
        if (key in data) data[key] = to(data[key]);
      }
      if (data.tagIds) data.tagIds = data.tagIds.map(to);
      if (data.photos) data.photos = data.photos.map((id) => photoMap.get(id) || id);
    }
  }
  return { photoMap, idMap: map };
};

export const restoreBackup = (userId, body) =>
  withUserLock(userId, async () => {
    if (body?.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new AppError(400, "backup.version");
    const parsed = parseCollections(body.collections);
    const settings = body.settings ? settingsSchema.safeParse(body.settings) : null;
    if (settings && !settings.success) throw invalid("settings", settings.error.issues[0].message);
    const baseCurrency = body.baseCurrency ? currency.safeParse(body.baseCurrency) : null;
    if (baseCurrency && !baseCurrency.success) throw invalid("baseCurrency", "bad currency");

    const { photoMap, idMap } = await remapForeignIds(userId, parsed);

    // What the account has now, to put back if writing the backup fails halfway.
    const before = {};
    for (const [collection, Model] of Object.entries(SYNCED_MODELS)) before[collection] = await Model.find({ userId }).lean();

    const total = Object.values(parsed).reduce((sum, items) => sum + items.length, 0);
    let seq = await reserveSeq(userId, total);
    try {
      for (const [collection, Model] of Object.entries(SYNCED_MODELS)) {
        await Model.deleteMany({ userId });
        await Model.insertMany(
          parsed[collection].map(({ id, data }) => ({ _id: id, userId, seq: ++seq, deletedAt: null, ...data })),
          { ordered: true }
        );
      }
    } catch (error) {
      for (const [collection, Model] of Object.entries(SYNCED_MODELS)) {
        await Model.deleteMany({ userId });
        if (before[collection].length) await Model.insertMany(before[collection]);
      }
      if (error?.code === 11000) throw new AppError(409, "backup.conflict");
      throw error;
    }

    const set = {};
    if (settings?.success) {
      const values = { ...settings.data };
      for (const key of ["homeAccount", "defaultAccountId"]) {
        if (values[key] && idMap?.has(values[key])) values[key] = idMap.get(values[key]);
      }
      for (const [key, value] of Object.entries(values)) set[`settings.${key}`] = value;
    }
    if (baseCurrency?.success) set.baseCurrency = baseCurrency.data;
    // Other devices see a new epoch and download everything again.
    const user = await UserModel.findByIdAndUpdate(userId, { $inc: { dataEpoch: 1 }, $set: set }, { new: true });
    return { user: user.toPublic(), photoIds: Object.fromEntries(photoMap) };
  });
