import { config } from "../config.js";
import SessionModel from "../models/session.js";
import PhotoModel from "../models/photo.js";
import TransactionModel from "../models/transaction.js";
import { SYNCED_MODELS } from "../utils/syncEngine.js";
import { destroyImage } from "../utils/cloudinary.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOMBSTONE_DAYS = 30;
const RUN_EVERY_MS = 6 * 60 * 60 * 1000;

// Revoked sessions are kept a month for the security log context; idle ones go after the inactivity limit.
const cleanSessions = () =>
  SessionModel.deleteMany({
    $or: [
      { revokedAt: { $lt: new Date(Date.now() - TOMBSTONE_DAYS * DAY_MS) } },
      { lastActiveAt: { $lt: new Date(Date.now() - config.refreshIdleDays * DAY_MS) } },
    ],
  });

// Soft-deleted records exist so other devices learn about the deletion. After 30 days they (and the photos of
// deleted transactions) are removed for good (spec 5.3, screen 5.3).
const purgeTombstones = async () => {
  const cutoff = new Date(Date.now() - TOMBSTONE_DAYS * DAY_MS);

  const deletedTransactions = await TransactionModel.find({ deletedAt: { $lt: cutoff }, "photos.0": { $exists: true } })
    .select("userId photos")
    .lean();
  for (const { userId, photos } of deletedTransactions) {
    const records = await PhotoModel.find({ _id: { $in: photos }, userId }).lean();
    await Promise.all(records.map((photo) => destroyImage(photo.publicId)));
    await PhotoModel.deleteMany({ _id: { $in: records.map((photo) => photo._id) } });
  }

  await Promise.all(Object.values(SYNCED_MODELS).map((Model) => Model.deleteMany({ deletedAt: { $lt: cutoff } })));
};

export const startCleanupJob = () => {
  const run = () =>
    Promise.all([cleanSessions(), purgeTombstones()]).catch((error) => console.log("cleanup job error:", error));
  run();
  setInterval(run, RUN_EVERY_MS).unref();
};
