import type { Period } from "@/api/types";
import { addDays, parseLocalDate, toLocalDate, todayLocal } from "./dates";

// Spec 2.8: day, week, month, year or a custom range. Dates are local "YYYY-MM-DD", both ends included.
export type PeriodKind = Period | "custom";
export type PeriodRange = { kind: PeriodKind; start: string; end: string };

export const PERIOD_KINDS: PeriodKind[] = ["day", "week", "month", "year", "custom"];

// The period of this kind that contains `date`. Weeks start on the user's first day (0 = Sunday).
export const periodContaining = (kind: Period, date: string, firstDay: number): PeriodRange => {
  const day = parseLocalDate(date);
  switch (kind) {
    case "day":
      return { kind, start: date, end: date };
    case "week": {
      const start = addDays(date, -((day.getDay() - firstDay + 7) % 7));
      return { kind, start, end: addDays(start, 6) };
    }
    case "month":
      return {
        kind,
        start: toLocalDate(new Date(day.getFullYear(), day.getMonth(), 1, 12)),
        end: toLocalDate(new Date(day.getFullYear(), day.getMonth() + 1, 0, 12)),
      };
    case "year":
      return { kind, start: `${day.getFullYear()}-01-01`, end: `${day.getFullYear()}-12-31` };
  }
};

export const currentPeriod = (kind: Period, firstDay: number) => periodContaining(kind, todayLocal(), firstDay);

const daysBetween = (start: string, end: string) =>
  Math.round((parseLocalDate(end).getTime() - parseLocalDate(start).getTime()) / 86_400_000);

// The previous (-1) or next (+1) period of the same kind. A custom range moves by its own length.
export const shiftPeriod = (range: PeriodRange, delta: -1 | 1, firstDay: number): PeriodRange => {
  if (range.kind === "custom") {
    const length = daysBetween(range.start, range.end) + 1;
    return { kind: "custom", start: addDays(range.start, delta * length), end: addDays(range.end, delta * length) };
  }
  const anchor = delta < 0 ? addDays(range.start, -1) : addDays(range.end, 1);
  return periodContaining(range.kind, anchor, firstDay);
};

// Ranges that already include today have nothing after them to look at (future entries become payments).
export const isLatestPeriod = (range: PeriodRange) => range.end >= todayLocal();

export const inPeriod = (date: string, range: PeriodRange) => date >= range.start && date <= range.end;

const format = (date: string, lang: string, options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(lang, options).format(parseLocalDate(date));
  } catch {
    return date;
  }
};

// "6 November 2026", "2 Nov – 8 Nov", "November 2026", "2026".
export const formatPeriod = (range: PeriodRange, lang: string) => {
  switch (range.kind) {
    case "day":
      return format(range.start, lang, { day: "numeric", month: "long", year: "numeric" });
    case "month":
      return format(range.start, lang, { month: "long", year: "numeric" });
    case "year":
      return range.start.slice(0, 4);
    default: {
      const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
      const thisYear = range.end.slice(0, 4) === todayLocal().slice(0, 4);
      const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
      const withYear: Intl.DateTimeFormatOptions = { ...options, year: "numeric" };
      if (range.start === range.end) return format(range.start, lang, withYear);
      return `${format(range.start, lang, sameYear ? options : withYear)} – ${format(range.end, lang, sameYear && thisYear ? options : withYear)}`;
    }
  }
};
