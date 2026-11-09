import UserModel from "../models/user.js";
import SessionModel from "../models/session.js";
import { checkPassword, hashPassword, verifyPassword } from "../utils/passwords.js";
import { AppError } from "../utils/AppError.js";
import { deleteUserData } from "../utils/userData.js";
import { logSecurityEvent } from "../utils/securityLog.js";
import { restoreBackup } from "../utils/restore.js";

const findUser = async (userId) => {
  const user = await UserModel.findById(userId);
  if (!user) throw new AppError(404, "user.notFound");
  return user;
};

export const getMe = async (req, res) => {
  const user = await findUser(req.userId);
  res.json({ user: user.toPublic() });
};

// Partial update: only the fields that were sent change; settings are merged key by key.
export const updateMe = async (req, res) => {
  const { settings, avatar, ...fields } = req.valid;
  const update = { ...fields };
  if (avatar) {
    update["avatar.icon"] = avatar.icon;
    update["avatar.color"] = avatar.color;
  }
  for (const [key, value] of Object.entries(settings || {})) {
    update[`settings.${key}`] = value;
  }

  const user = await UserModel.findByIdAndUpdate(req.userId, { $set: update }, { new: true, runValidators: true });
  if (!user) throw new AppError(404, "user.notFound");
  res.json({ user: user.toPublic() });
};

// Screen 12 "Delete account": the user, all their data and photos, and every session (required by both stores).
export const deleteMe = async (req, res) => {
  await findUser(req.userId);
  await deleteUserData(req.userId, { keepAccount: false });
  logSecurityEvent("account_deleted", { req, meta: { userId: req.userId } });
  res.status(204).end();
};

// Settings -> Data -> "Delete all data": accounts, transactions, transfers, tags, payments, reminders and photos go;
// categories are reset to the defaults; the account and settings stay.
export const deleteAllData = async (req, res) => {
  await findUser(req.userId);
  await deleteUserData(req.userId, { keepAccount: true });
  logSecurityEvent("data_deleted", { userId: req.userId, sessionId: req.sessionId, req });
  const user = await findUser(req.userId);
  res.json({ user: user.toPublic() });
};

// Settings -> Data -> "Restore a backup": every record of the account is replaced by the file's (spec 13.4).
export const restoreData = async (req, res) => {
  await findUser(req.userId);
  const result = await restoreBackup(req.userId, req.body);
  logSecurityEvent("data_restored", { userId: req.userId, sessionId: req.sessionId, req });
  res.json(result);
};

// The current password must be right (unless there is none yet). Every other device is signed out: a changed password
// usually means someone else might know the old one. This device stays signed in.
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.valid;
  const user = await findUser(req.userId);
  if (user.passwordHash && !(await verifyPassword(currentPassword ?? "", user.passwordHash))) {
    logSecurityEvent("password_change_failed", { userId: user._id, sessionId: req.sessionId, req });
    throw new AppError(400, "auth.wrongPassword");
  }
  const problem = checkPassword(newPassword);
  if (problem) throw new AppError(400, problem);

  user.passwordHash = await hashPassword(newPassword);
  user.failedLogins = 0;
  user.lockedUntil = null;
  await user.save();
  const ended = await SessionModel.updateMany(
    { userId: user._id, revokedAt: null, _id: { $ne: req.sessionId } },
    { $set: { revokedAt: new Date(), revokeReason: "password" } }
  );
  logSecurityEvent("password_changed", { userId: user._id, sessionId: req.sessionId, req, meta: { endedSessions: ended.modifiedCount } });
  res.json({ user: user.toPublic(), endedSessions: ended.modifiedCount });
};
