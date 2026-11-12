import { todayLocal } from "./dates";
import { inPeriod, type PeriodRange } from "./periods";
import { router } from "expo-router";
import type { EntryType } from "@/api/types";

// Opens the add-entry screen (screen 4); Home's "+" and other screens use it.
// date: the day the new entry is for (the form starts on today without it).
export const openNewTransaction = (type?: EntryType, date?: string) =>
  router.push({ pathname: "/transaction/[id]", params: { id: "new", ...(type && { type }), ...(date && { date }) } });

// The day a new entry from a list showing `range` is for: today when the range holds it, else the day shown (or the
// first day of the week, month or year shown).
export const entryDateFor = (range: PeriodRange) => (inPeriod(todayLocal(), range) ? undefined : range.start);

export const openTransaction = (id: string) => router.push({ pathname: "/transaction/[id]", params: { id } });
