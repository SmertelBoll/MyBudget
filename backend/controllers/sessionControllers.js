import mongoose from "mongoose";
import { config } from "../config.js";
import SessionModel from "../models/session.js";
import { AppError } from "../utils/AppError.js";
import { logSecurityEvent } from "../utils/securityLog.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const activeFilter = (userId) => ({
  userId,
  revokedAt: null,
  lastActiveAt: { $gte: new Date(Date.now() - config.refreshIdleDays * DAY_MS) },
});

// Spec 3.3: the device list in Settings -> Security and sessions.
export const getSessions = async (req, res) => {
  const sessions = await SessionModel.find(activeFilter(req.userId)).sort({ lastActiveAt: -1 });
  res.json({ sessions: sessions.map((session) => session.toPublic(req.sessionId)) });
};

export const revokeOtherSessions = async (req, res) => {
  const result = await SessionModel.updateMany(
    { ...activeFilter(req.userId), _id: { $ne: req.sessionId } },
    { $set: { revokedAt: new Date(), revokeReason: "remote" } }
  );
  logSecurityEvent("sessions_revoked_others", { userId: req.userId, sessionId: req.sessionId, req, meta: { count: result.modifiedCount } });
  res.json({ revoked: result.modifiedCount });
};

// The current device can't end itself here; that's "Log out".
export const revokeSession = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, "session.notFound");
  if (id === String(req.sessionId)) throw new AppError(400, "session.cannotRevokeCurrent");

  const result = await SessionModel.updateOne(
    { ...activeFilter(req.userId), _id: id },
    { $set: { revokedAt: new Date(), revokeReason: "remote" } }
  );
  if (!result.matchedCount) throw new AppError(404, "session.notFound");

  logSecurityEvent("session_revoked", { userId: req.userId, sessionId: req.sessionId, req, meta: { revoked: id } });
  res.status(204).end();
};
