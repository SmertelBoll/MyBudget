import { z } from "zod";
import { LANGUAGE_CODES } from "../utils/languages.js";
import { color, currency, icon } from "./common.js";

export const settingsSchema = z
  .object({
    homeAccount: z.string().trim().min(1).max(64),
    defaultPeriod: z.enum(["day", "week", "month", "year"]),
    defaultAccountId: z.string().trim().min(1).max(64).nullable(),
    showComment: z.boolean(),
    showPhotos: z.boolean(),
    firstDayOfWeek: z.number().int().min(0).max(6),
    decimalSeparator: z.enum([".", ","]),
    showCents: z.boolean(),
    focus: z.enum(["expense", "income"]),
  })
  .partial();

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    avatar: z.object({ icon, color }),
    baseCurrency: currency,
    language: z.enum(LANGUAGE_CODES),
    theme: z.enum(["system", "light", "dark"]),
    onboarded: z.boolean(),
    settings: settingsSchema,
  })
  .partial();

export const supportSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(5000),
  appVersion: z.string().trim().max(20).default(""),
  device: z.string().trim().max(100).default(""),
  screenshotPhotoId: z.string().trim().min(1).max(64).optional(),
});
