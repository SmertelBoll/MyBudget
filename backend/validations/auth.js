import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

const device = z
  .object({
    deviceId: z.string().trim().max(100).default(""),
    deviceName: z.string().trim().max(100).default(""),
    platform: z.enum(["ios", "android", "web", "other"]).default("other"),
    appVersion: z.string().trim().max(20).default(""),
  })
  .default({});

export const registerSchema = z.object({
  email,
  // Length and common-password rules are checked in the controller, so they get their own error codes.
  password: z.string().max(128),
  name: z.string().trim().min(1).max(50).optional(),
  device,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
  device,
});

export const googleSchema = z.object({
  idToken: z.string().min(10).max(4096),
  device,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).max(300),
});
