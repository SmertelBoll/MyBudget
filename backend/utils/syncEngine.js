import UserModel from "../models/user.js";
import AccountModel from "../models/account.js";
import CategoryModel from "../models/category.js";
import TagModel from "../models/tag.js";
import TransactionModel from "../models/transaction.js";
import TransferModel from "../models/transfer.js";
import RecurringModel from "../models/recurring.js";
import ReminderModel from "../models/reminder.js";
import { entitySchemas } from "../validations/entities.js";
import { AppError } from "./AppError.js";
import { withUserLock } from "./userLock.js";

export const SYNCED_MODELS = {
  accounts: AccountModel,
  categories: CategoryModel,
  tags: TagModel,
  transactions: TransactionModel,
  transfers: TransferModel,
  recurring: RecurringModel,
  reminders: ReminderModel,
};

// Takes `count` change numbers for the user; returns the one before the first, so callers do `seq += 1` per write.
// Only call inside withUserLock.
export const reserveSeq = async (userId, count) => {
  const user = await UserModel.findByIdAndUpdate(
    userId,
    { $inc: { syncSeq: count } },
    { new: true, projection: { syncSeq: 1 } }
  ).lean();
  if (!user) throw new AppError(404, "user.notFound");
  return user.syncSeq - count;
};

// Rules the client can't be trusted with. They change `data` in place before it's written.
const upsertGuards = {
  accounts: (data, existing) => {
    if (existing) data.currency = existing.currency;
  },
  categories: (data, existing) => {
    data.isSystemOther = existing?.isSystemOther ?? false;
    if (existing) data.type = existing.type;
    // "Other" is the fallback for deleted categories: only its color and place in the list may change, and it is
    // never hidden.
    if (existing?.isSystemOther) {
      for (const field of ["name", "nameKey", "icon", "plannedMonthly"]) data[field] = existing[field];
      data.hidden = false;
    }
  },
  tags: async (data, existing, { userId, id }) => {
    data.nameLower = data.name.toLowerCase();
    const duplicate = await TagModel.exists({ userId, nameLower: data.nameLower, deletedAt: null, _id: { $ne: id } });
    if (duplicate) throw new AppError(409, "tag.duplicate");
  },
};

const deleteGuards = {
  categories: (existing) => {
    if (existing.isSystemOther) throw new AppError(400, "category.otherNotDeletable");
  },
};

const applyChange = async (userId, change, seq) => {
  const Model = SYNCED_MODELS[change.collection];
  const existing = await Model.findById(change.id).lean();
  if (existing && String(existing.userId) !== String(userId)) {
    throw new AppError(403, "sync.forbidden");
  }

  if (change.op === "delete") {
    // Created and deleted offline (never reached the server), or already deleted: nothing to do.
    if (!existing || existing.deletedAt) return;
    deleteGuards[change.collection]?.(existing);
    await Model.updateOne({ _id: change.id }, { $set: { deletedAt: new Date(), seq } });
    return;
  }

  // A stale offline edit must not bring a deleted record back; the client drops it on the next pull.
  if (existing?.deletedAt) throw new AppError(409, "sync.deleted");

  const parsed = entitySchemas[change.collection].safeParse(change.data ?? {});
  if (!parsed.success) {
    throw new AppError(
      400,
      "common.validation",
      parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    );
  }
  const data = parsed.data;
  await upsertGuards[change.collection]?.(data, existing, { userId, id: change.id });

  try {
    // Last write wins by arrival order at the server (spec 4.1).
    await Model.updateOne(
      { _id: change.id, userId },
      { $set: { ...data, seq }, $setOnInsert: { deletedAt: null } },
      { upsert: true }
    );
  } catch (error) {
    // Same id inserted by another user between the check above and this write.
    if (error.code === 11000) throw new AppError(403, "sync.forbidden");
    throw error;
  }
};

const toResult = (change, error) => ({
  collection: change.collection,
  id: change.id,
  status: error ? "rejected" : "applied",
  ...(error && { code: error.code, ...(error.details && { details: error.details }) }),
});

// A batch from /sync/push. Changes are applied one by one in order; a rejected change doesn't stop the rest, and the
// client gets a per-change result. Repeating the same batch is harmless: upserts by id, deletes are no-ops.
export const applyChanges = (userId, epoch, changes) =>
  withUserLock(userId, async () => {
    const user = await UserModel.findById(userId).select("dataEpoch").lean();
    if (!user) throw new AppError(404, "user.notFound");
    if (epoch !== user.dataEpoch) throw new AppError(409, "sync.reset");

    let seq = await reserveSeq(userId, changes.length);
    const results = [];
    for (const change of changes) {
      seq += 1;
      try {
        await applyChange(userId, change, seq);
        results.push(toResult(change));
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        results.push(toResult(change, error));
      }
    }
    return results;
  });

// One change from the plain CRUD routes; errors are thrown instead of collected.
export const applySingleChange = (userId, change) =>
  withUserLock(userId, async () => {
    const seq = (await reserveSeq(userId, 1)) + 1;
    await applyChange(userId, change, seq);
  });

const serialize = (collection, doc) => {
  // eslint-disable-next-line no-unused-vars
  const { _id, userId, seq, deletedAt, nameLower, ...data } = doc;
  return deletedAt ? { collection, id: _id, seq, deleted: true } : { collection, id: _id, seq, deleted: false, data };
};

export const toEntity = (doc) => {
  const { data, id } = serialize(null, doc);
  return { id, ...data };
};

// Everything changed after `since`, oldest first, across all collections. Each collection returns at most limit+1
// rows, so the first `limit` of the merged list are the globally oldest ones.
export const pullChanges = async (userId, { since, epoch, limit }) => {
  const user = await UserModel.findById(userId).select("dataEpoch").lean();
  if (!user) throw new AppError(404, "user.notFound");
  if (epoch !== undefined && epoch !== user.dataEpoch) {
    return { reset: true, epoch: user.dataEpoch };
  }

  const batches = await Promise.all(
    Object.entries(SYNCED_MODELS).map(async ([collection, Model]) => {
      const docs = await Model.find({ userId, seq: { $gt: since } })
        .sort({ seq: 1 })
        .limit(limit + 1)
        .lean();
      return docs.map((doc) => serialize(collection, doc));
    })
  );
  const all = batches.flat().sort((a, b) => a.seq - b.seq);
  const changes = all.slice(0, limit);

  return {
    reset: false,
    epoch: user.dataEpoch,
    changes,
    cursor: changes.length ? changes.at(-1).seq : since,
    hasMore: all.length > limit,
    serverTime: new Date(),
  };
};
