import { rateLimit } from "express-rate-limit";
import { config } from "../config.js";

const base = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => config.env === "test",
  handler: (req, res) => res.status(429).json({ code: "common.tooManyRequests" }),
};

// Login, registration and Google sign-in, per IP. The per-account lockout lives in the login controller.
export const authLimiter = rateLimit({ ...base, limit: 20 });
export const refreshLimiter = rateLimit({ ...base, limit: 120 });
export const supportLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, limit: 10 });
