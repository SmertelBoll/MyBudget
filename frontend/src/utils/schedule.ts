import type { RepeatRule } from "@/data/types";
import { addDays, parseLocalDate, toLocalDate, todayLocal } from "./dates";

// Spec 8.3, 8.4, 9: when a regular payment or a reminder happens. Everything is in the user's local time; dates are
// "YYYY-MM-DD", times "HH:MM". Payments and reminders share this code (one parser for cron, as the spec asks).

export type Occurrence = { date: string; time: string };
export type Schedule = { rule: RepeatRule; startDate: string; time: string; endDate?: string | null };

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / DAY_MS);
const monthsBetween = (from: string, to: string) =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
const daysInMonth = (date: string) => new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate();
// Day 31 in a 30-day month (or 29 Feb in other years) falls on the month's last day.
const sameDayOfMonth = (start: string, date: string) =>
  Number(date.slice(8, 10)) === Math.min(Number(start.slice(8, 10)), daysInMonth(date));
const weekday = (date: string) => parseLocalDate(date).getDay();
// Weeks counted from the Monday of the start's week.
const weekIndex = (start: string, date: string) => {
  const monday = (value: string) => addDays(value, -((weekday(value) + 6) % 7));
  return Math.round(daysBetween(monday(start), monday(date)) / 7);
};

// ---- cron (5 fields: minute hour day-of-month month day-of-week) --------------------------------------------------

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type CronField = { values: Set<number>; any: boolean };
export type Cron = { minute: CronField; hour: CronField; dom: CronField; month: CronField; dow: CronField };

const parseField = (text: string, min: number, max: number, names?: string[]): CronField | null => {
  const values = new Set<number>();
  const value = (token: string) => {
    const upper = token.toUpperCase();
    const named = names?.indexOf(upper) ?? -1;
    if (named >= 0) return named + (names === MONTH_NAMES ? 1 : 0);
    return /^\d+$/.test(token) ? Number(token) : NaN;
  };
  for (const part of text.split(",")) {
    const [range, stepText] = part.split("/");
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) return null;
    let from: number;
    let to: number;
    if (range === "*") [from, to] = [min, max];
    else if (range.includes("-")) [from, to] = range.split("-").map(value) as [number, number];
    else {
      from = value(range);
      to = stepText === undefined ? from : max;
    }
    // Day of week 7 is Sunday too.
    if (names === DAY_NAMES) {
      if (from === 7) from = 0;
      if (to === 7 && from > 0) to = 6;
    }
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < min || to > max || from > to) return null;
    for (let v = from; v <= to; v += step) values.add(v === 7 && names === DAY_NAMES ? 0 : v);
  }
  return { values, any: text === "*" };
};

export const parseCron = (expression: string): Cron | null => {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const minute = parseField(fields[0], 0, 59);
  const hour = parseField(fields[1], 0, 23);
  const dom = parseField(fields[2], 1, 31);
  const month = parseField(fields[3], 1, 12, MONTH_NAMES);
  const dow = parseField(fields[4], 0, 7, DAY_NAMES);
  return minute && hour && dom && month && dow ? { minute, hour, dom, month, dow } : null;
};

const cronDayMatches = (cron: Cron, date: string) => {
  if (!cron.month.values.has(Number(date.slice(5, 7)))) return false;
  const domOk = cron.dom.values.has(Number(date.slice(8, 10)));
  const dowOk = cron.dow.values.has(weekday(date));
  // Standard cron: with both day fields restricted, either one is enough.
  if (!cron.dom.any && !cron.dow.any) return domOk || dowOk;
  return domOk && dowOk;
};

const pad = (n: number) => String(n).padStart(2, "0");
const cronTimes = (cron: Cron) =>
  [...cron.hour.values].sort((a, b) => a - b).flatMap((h) => [...cron.minute.values].sort((a, b) => a - b).map((m) => `${pad(h)}:${pad(m)}`));

// ---- rules -------------------------------------------------------------------------------------------------------

const dayMatches = (rule: RepeatRule, start: string, date: string, cron: Cron | null): boolean => {
  if (date < start) return false;
  switch (rule.kind) {
    case "once":
      return date === start;
    case "daily":
      return true;
    case "weekly":
      return daysBetween(start, date) % 7 === 0;
    case "monthly":
      return sameDayOfMonth(start, date);
    case "quarterly":
      return monthsBetween(start, date) % 3 === 0 && sameDayOfMonth(start, date);
    case "yearly":
      return monthsBetween(start, date) % 12 === 0 && sameDayOfMonth(start, date);
    case "custom": {
      if (cron) return cronDayMatches(cron, date);
      const every = rule.every ?? 1;
      if (rule.unit === "week") {
        const days = rule.weekdays?.length ? rule.weekdays : [weekday(start)];
        return weekIndex(start, date) % every === 0 && days.includes(weekday(date));
      }
      if (rule.unit === "month") return monthsBetween(start, date) % every === 0 && sameDayOfMonth(start, date);
      return daysBetween(start, date) % every === 0;
    }
  }
};

// Occurrences from `from` to `to` (both dates included), oldest first, at most `limit`.
export const occurrencesBetween = (schedule: Schedule, from: string, to: string, limit = 500): Occurrence[] => {
  const { rule, startDate, time, endDate } = schedule;
  const cron = rule.kind === "custom" && rule.cron ? parseCron(rule.cron) : null;
  if (rule.kind === "custom" && rule.cron && !cron) return [];
  const first = from > startDate ? from : startDate;
  const last = endDate && endDate < to ? endDate : to;
  const result: Occurrence[] = [];
  if (rule.kind === "once") {
    if (startDate >= first && startDate <= last) result.push({ date: startDate, time });
    return result;
  }
  for (let date = first; date <= last && result.length < limit; date = addDays(date, 1)) {
    if (!dayMatches(rule, startDate, date, cron)) continue;
    for (const at of cron ? cronTimes(cron) : [time]) {
      if (result.length < limit) result.push({ date, time: at });
    }
  }
  return result;
};

const nowMinute = () => {
  const now = new Date();
  return { date: toLocalDate(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}` };
};

// The next occurrence that hasn't happened yet (its date and time still ahead), or null when the schedule is over.
// Searches up to 5 years ahead (enough for any yearly rule).
export const nextOccurrence = (schedule: Schedule, after = nowMinute()): Occurrence | null => {
  const horizon = addDays(after.date, 366 * 5);
  for (let from = after.date; from <= horizon; from = addDays(from, 60)) {
    const chunk = occurrencesBetween(schedule, from, addDays(from, 59), 2000);
    const next = chunk.find((o) => o.date > after.date || (o.date === after.date && o.time > after.time));
    if (next) return next;
    if (schedule.rule.kind === "once") return null;
    if (schedule.endDate && addDays(from, 59) >= schedule.endDate) return null;
  }
  return null;
};

// Occurrences that are due (date and time already passed) and come after `since` (exclusive), oldest first; at most
// `maxDays` back from today (spec 8.4: missed payments are added up to 60 days back).
export const dueOccurrences = (schedule: Schedule, since: string | null, maxDays = 60): Occurrence[] => {
  const now = nowMinute();
  const earliest = addDays(todayLocal(), -maxDays);
  const from = since ? addDays(since, 1) : schedule.startDate;
  return occurrencesBetween(schedule, from > earliest ? from : earliest, now.date).filter(
    (o) => o.date < now.date || o.time <= now.time
  );
};

export const isValidCron = (expression: string) => parseCron(expression) !== null;
