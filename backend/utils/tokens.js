import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const signAccessToken = (userId, sessionId) =>
  jwt.sign({ sid: String(sessionId) }, config.jwtAccessSecret, {
    subject: String(userId),
    expiresIn: config.accessTtl,
    algorithm: "HS256",
  });

// "<sessionId>.<random>": the session is found by id and then the hash is compared, so the secret part is never
// used as a lookup key.
export const generateRefreshToken = (sessionId) => `${sessionId}.${crypto.randomBytes(48).toString("base64url")}`;

export const sessionIdFromRefreshToken = (token) => token.split(".")[0];

export const hashRefreshToken = (token) =>
  crypto.createHmac("sha256", config.jwtRefreshSecret).update(token).digest("hex");

export const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};
