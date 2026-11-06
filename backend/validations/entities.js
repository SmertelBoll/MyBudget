import { z } from "zod";
import {
  color,
  currency,
  icon,
  id,
  isoDateTime,
  localDate,
  minor,
  positiveMinor,
  time,
} from "./common.js";

const type = z.enum(["expense", "income"]);
const tagIds = z.array(id).max(50).default([]);
const comment = z.string().max(500).default("");
const sortOrder = z.number().int().default(0);

const CRON_FIELDS = /^\S+(\s+\S+){4}$/;

const rule = z
  .object({
    kind: z.enum(["once", "daily", "weekly", "monthly", "quarterly", "yearly", "custom"]),
    every: z.number().int().min(1).max(365).optional(),
    unit: z.enum(["day", "week", "month"]).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    cron: z.string().trim().max(100).regex(CRON_FIELDS).optional(),
  })
  .refine((r) => r.kind !== "custom" || Boolean(r.cron) || Boolean(r.every && r.unit), {
    message: "custom rule needs cron or every + unit",
  });

// Full record as the client sends it on every upsert. Unknown keys are stripped, so a client can never set
// userId, seq or deletedAt.
export const entitySchemas = {
  accounts: z.object({
    name: z.string().trim().min(1).max(50),
    currency,
    icon,
    color,
    includeInTotal: z.boolean().default(true),
    note: z.string().max(200).default(""),
    balanceAnchor: minor.default(0),
    balanceAnchorAt: isoDateTime,
    sortOrder,
    isActive: z.boolean().default(true),
  }),
  categories: z
    .object({
      name: z.string().trim().min(1).max(50).nullable().default(null),
      nameKey: z.string().trim().min(1).max(64).nullable().default(null),
      type,
      icon,
      color,
      plannedMonthly: positiveMinor.nullable().default(null),
      sortOrder,
    })
    .refine((c) => c.name || c.nameKey, { message: "name or nameKey is required" }),
  tags: z.object({
    name: z.string().trim().min(1).max(20),
  }),
  transactions: z.object({
    type,
    accountId: id,
    categoryId: id,
    tagIds,
    amount: positiveMinor,
    currency,
    accountAmount: positiveMinor,
    rate: z.number().positive(),
    date: localDate,
    comment,
    photos: z.array(id).max(3).default([]),
    recurringId: id.nullable().default(null),
    clientCreatedAt: isoDateTime,
  }),
  transfers: z
    .object({
      fromAccountId: id,
      toAccountId: id,
      amountFrom: positiveMinor,
      amountTo: positiveMinor,
      rate: z.number().positive(),
      date: localDate,
      comment,
      clientCreatedAt: isoDateTime,
    })
    .refine((t) => t.fromAccountId !== t.toAccountId, { message: "accounts must differ" }),
  recurring: z.object({
    type,
    name: z.string().trim().min(1).max(50),
    rule,
    autoAdd: z.boolean().default(true),
    startDate: localDate,
    time,
    endDate: localDate.nullable().default(null),
    accountId: id,
    categoryId: id,
    amount: positiveMinor,
    currency,
    tagIds,
    comment,
    notify: z.boolean().default(true),
    lastGeneratedAt: localDate.nullable().default(null),
  }),
  reminders: z.object({
    title: z.string().trim().min(1).max(50),
    rule,
    startDate: localDate,
    time,
    comment,
    active: z.boolean().default(true),
  }),
};

export const SYNCED_COLLECTIONS = Object.keys(entitySchemas);

export const pushSchema = z.object({
  // The client's dataEpoch; a mismatch means "delete all data" happened elsewhere and these changes are stale.
  epoch: z.number().int().min(0),
  changes: z
    .array(
      z.object({
        collection: z.enum(SYNCED_COLLECTIONS),
        id,
        op: z.enum(["upsert", "delete"]),
        data: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .min(1)
    .max(500),
});

export const pullSchema = z.object({
  since: z.coerce.number().int().min(0).default(0),
  epoch: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
