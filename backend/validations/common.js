import { z } from "zod";

export const id = z.string().trim().min(1).max(64);
export const currency = z.string().regex(/^[A-Z]{3}$/);
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const icon = z.string().trim().min(1).max(64);
export const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
// Integer minor units (cents)
export const minor = z.number().int().min(-1e15).max(1e15);
export const positiveMinor = z.number().int().positive().max(1e15);
export const isoDateTime = z.coerce.date();
