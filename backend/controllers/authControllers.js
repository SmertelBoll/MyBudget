import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";
import UserModel from "../models/user.js";
import SessionModel from "../models/session.js";
import { AppError } from "../utils/AppError.js";
import { checkPassword, hashPassword, verifyPassword } from "../utils/passwords.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  safeEqual,
  sessionIdFromRefreshToken,
  signAccessToken,
} from "../utils/tokens.js";
import { createDefaultCategories } from "../utils/defaultData.js";
import { lookupLocation } from "../utils/geo.js";
import { logSecurityEvent } from "../utils/securityLog.js";

const LOCK_AFTER_FAILURES = 5;
const LOCK_MINUTES = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

const googleClient = new OAuth2Client();

const checkEmailDomain = (email) => {
  const domain = email.split("@")[1];
  if (config.allowedEmailDomains.length && !config.allowedEmailDomains.includes(domain)) {
    throw new AppError(400, "auth.emailDomainNotAllowed", { allowed: config.allowedEmailDomains });
  }
};

const startSession = async (user, device, req) => {
  const sessionId = new mongoose.Types.ObjectId();
  const refreshToken = generateRefreshToken(sessionId);
  const session = await SessionModel.create({
    _id: sessionId,
    userId: user._id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    ...device,
    ip: req.ip,
    location: await lookupLocation(req.ip),
    lastActiveAt: new Date(),
  });
  return { session, refreshToken };
};

const authPayload = (user, session, refreshToken) => ({
  user: user.toPublic(),
  sessionId: session._id,
  accessToken: signAccessToken(user._id, session._id),
  refreshToken,
});

const revokeSession = (sessionId, reason) =>
  SessionModel.updateOne({ _id: sessionId, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: reason } });

const defaultName = (email) => email.split("@")[0].slice(0, 50);

export const register = async (req, res) => {
  const { email, password, name, device } = req.valid;

  checkEmailDomain(email);
  const passwordError = checkPassword(password);
  if (passwordError) throw new AppError(400, passwordError);
  if (await UserModel.exists({ email })) throw new AppError(409, "auth.emailTaken");

  let user;
  try {
    user = await UserModel.create({ email, name: name || defaultName(email), passwordHash: await hashPassword(password) });
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, "auth.emailTaken");
    throw error;
  }
  await createDefaultCategories(user._id);

  const { session, refreshToken } = await startSession(user, device, req);
  logSecurityEvent("register", { userId: user._id, sessionId: session._id, req });
  res.status(201).json(authPayload(user, session, refreshToken));
};

export const login = async (req, res) => {
  const { email, password, device } = req.valid;
  const user = await UserModel.findOne({ email });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(429, "auth.tooManyAttempts", { retryAt: user.lockedUntil });
  }

  const isValid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !isValid) {
    if (user) {
      user.failedLogins += 1;
      if (user.failedLogins >= LOCK_AFTER_FAILURES) {
        user.failedLogins = 0;
        user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      }
      await user.save();
      logSecurityEvent("login_failed", { userId: user._id, req });
    }
    // Same answer for an unknown email and a wrong password.
    throw new AppError(401, "auth.invalidCredentials");
  }

  if (user.failedLogins || user.lockedUntil) {
    user.failedLogins = 0;
    user.lockedUntil = null;
    await user.save();
  }

  const { session, refreshToken } = await startSession(user, device, req);
  logSecurityEvent("login", { userId: user._id, sessionId: session._id, req });
  res.json(authPayload(user, session, refreshToken));
};

// Google ID token from the app. If an account with the same email exists, Google is linked to it (no duplicate).
export const googleLogin = async (req, res) => {
  const { idToken, device } = req.valid;
  if (!config.googleClientIds.length) throw new AppError(503, "auth.googleNotConfigured");

  let payload;
  try {
    // Checks the signature, audience (our client ids) and expiry.
    const ticket = await googleClient.verifyIdToken({ idToken, audience: config.googleClientIds });
    payload = ticket.getPayload();
  } catch {
    throw new AppError(401, "auth.googleInvalidToken");
  }
  if (!payload?.email || !payload.email_verified) throw new AppError(401, "auth.googleEmailNotVerified");

  const email = payload.email.toLowerCase();
  let user = (await UserModel.findOne({ googleId: payload.sub })) || (await UserModel.findOne({ email }));
  let created = false;

  if (!user) {
    user = await UserModel.create({ email, googleId: payload.sub, name: (payload.name || defaultName(email)).slice(0, 50) });
    await createDefaultCategories(user._id);
    created = true;
  } else if (!user.googleId) {
    user.googleId = payload.sub;
    await user.save();
  }

  const { session, refreshToken } = await startSession(user, device, req);
  logSecurityEvent(created ? "register_google" : "login_google", { userId: user._id, sessionId: session._id, req });
  res.status(created ? 201 : 200).json(authPayload(user, session, refreshToken));
};

// Rotation (spec 3.2): every refresh issues a new refresh token and retires the old one. Presenting the retired one
// again means the token was copied, so the whole session ends. The client must not refresh in parallel.
export const refresh = async (req, res) => {
  const { refreshToken } = req.valid;
  const sessionId = sessionIdFromRefreshToken(refreshToken);
  if (!mongoose.isValidObjectId(sessionId)) throw new AppError(401, "session.invalid");

  const session = await SessionModel.findById(sessionId);
  if (!session) throw new AppError(401, "session.invalid");
  if (session.revokedAt) throw new AppError(401, "session.revoked", { reason: session.revokeReason });

  const hash = hashRefreshToken(refreshToken);
  if (!safeEqual(hash, session.refreshTokenHash)) {
    if (session.prevRefreshTokenHash && safeEqual(hash, session.prevRefreshTokenHash)) {
      await revokeSession(session._id, "reuse");
      logSecurityEvent("refresh_reuse", { userId: session.userId, sessionId: session._id, req });
      throw new AppError(401, "session.revoked", { reason: "reuse" });
    }
    throw new AppError(401, "session.invalid");
  }

  // Sliding window: the session ends only after refreshIdleDays without any refresh.
  if (session.lastActiveAt < new Date(Date.now() - config.refreshIdleDays * DAY_MS)) {
    await revokeSession(session._id, "expired");
    throw new AppError(401, "session.expired");
  }

  const user = await UserModel.findById(session.userId);
  if (!user) throw new AppError(401, "session.invalid");

  const nextToken = generateRefreshToken(session._id);
  const update = {
    refreshTokenHash: hashRefreshToken(nextToken),
    prevRefreshTokenHash: hash,
    lastActiveAt: new Date(),
  };
  if (req.ip !== session.ip) {
    update.ip = req.ip;
    update.location = await lookupLocation(req.ip);
  }

  // Conditional on the old hash: of two simultaneous refreshes with the same token only one rotates.
  const rotated = await SessionModel.findOneAndUpdate(
    { _id: session._id, refreshTokenHash: hash, revokedAt: null },
    { $set: update },
    { new: true }
  );
  if (!rotated) throw new AppError(401, "session.invalid");

  res.json(authPayload(user, rotated, nextToken));
};

// Takes the refresh token rather than the access token, so it works even when the access token has expired.
// Always 204: the answer must not reveal whether the token was valid.
export const logout = async (req, res) => {
  const { refreshToken } = req.valid;
  const sessionId = sessionIdFromRefreshToken(refreshToken);

  if (mongoose.isValidObjectId(sessionId)) {
    const session = await SessionModel.findById(sessionId);
    if (session && !session.revokedAt && safeEqual(hashRefreshToken(refreshToken), session.refreshTokenHash)) {
      await revokeSession(session._id, "logout");
      logSecurityEvent("logout", { userId: session.userId, sessionId: session._id, req });
    }
  }
  res.status(204).end();
};
