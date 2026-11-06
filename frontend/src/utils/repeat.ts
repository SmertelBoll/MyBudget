import cronstrue from "cronstrue/i18n";
import type { RepeatRule } from "@/data/types";
import { isValidCron } from "./schedule";

export const REPEAT_KINDS: RepeatRule["kind"][] = ["once", "daily", "weekly", "monthly", "quarterly", "yearly", "custom"];

// App language -> cronstrue locale; the rest fall back to English.
const CRON_LOCALES: Record<string, string> = { pt: "pt_BR", zh: "zh_CN", no: "nb" };
const CRON_KNOWN = new Set(["en", "uk", "de", "fr", "es", "it", "pl", "ja", "ko", "tr", "ar", "cs", "da", "fi", "hu", "nl", "sv", "pt_BR", "zh_CN", "nb"]);

// "At 09:00, only on Monday" in the user's language; null for an invalid expression.
export const describeCron = (expression: string, lang: string) => {
  if (!isValidCron(expression)) return null;
  const mapped = CRON_LOCALES[lang] ?? lang;
  try {
    return cronstrue.toString(expression, { locale: CRON_KNOWN.has(mapped) ? mapped : "en", use24HourTimeFormat: true });
  } catch {
    return null;
  }
};

const weekdayName = (day: number, lang: string) => {
  try {
    // 2023-01-01 was a Sunday.
    return new Intl.DateTimeFormat(lang, { weekday: "short" }).format(new Date(2023, 0, 1 + day, 12));
  } catch {
    return String(day);
  }
};

// Short name of a rule for lists and the form: "Monthly", "Every 2 weeks: Mon, Fri", or the cron description.
export const describeRule = (rule: RepeatRule, t: (key: string, params?: Record<string, string | number>) => string, lang: string) => {
  if (rule.kind !== "custom") return t(`repeat.${rule.kind}`);
  if (rule.cron) return describeCron(rule.cron, lang) ?? rule.cron;
  const every = rule.every ?? 1;
  const unit = rule.unit ?? "day";
  const base = t(unit === "week" ? "repeat.everyWeeks" : unit === "month" ? "repeat.everyMonths" : "repeat.everyDays", { count: every });
  if (unit === "week" && rule.weekdays?.length) {
    // Monday first in the list, as in most of the app's languages.
    const ordered = [...rule.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return `${base}: ${ordered.map((day) => weekdayName(day, lang)).join(", ")}`;
  }
  return base;
};
