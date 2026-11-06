import UserModel from "../models/user.js";
import { AppError } from "../utils/AppError.js";
import { deleteUserData } from "../utils/userData.js";
import { logSecurityEvent } from "../utils/securityLog.js";

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
