// Operation dates are the user's local calendar day, "YYYY-MM-DD" (spec 5.2); never shifted through UTC.

const pad = (value: number) => String(value).padStart(2, "0");

export const toLocalDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayLocal = () => toLocalDate(new Date());

// Noon avoids DST edges when stepping days.
export const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

export const addDays = (value: string, days: number) => {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return toLocalDate(date);
};

const safeFormat = (date: Date, lang: string, options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(lang, options).format(date);
  } catch {
    return date.toDateString();
  }
};

// "5 November 2026 (Thu)"
export const formatLongDate = (value: string, lang: string) => {
  const date = parseLocalDate(value);
  const main = safeFormat(date, lang, { day: "numeric", month: "long", year: "numeric" });
  const weekday = safeFormat(date, lang, { weekday: "short" });
  return `${main} (${weekday})`;
};

// "05/11"
export const formatShortDate = (value: string, lang: string) =>
  safeFormat(parseLocalDate(value), lang, { day: "2-digit", month: "2-digit" });

export const formatMonthTitle = (year: number, month: number, lang: string) =>
  safeFormat(new Date(year, month, 1, 12), lang, { month: "long", year: "numeric" });

// Weekday names starting from the user's first day of the week (0 = Sunday).
export const weekdayNames = (lang: string, firstDay: number) =>
  Array.from({ length: 7 }, (_, i) => {
    const day = (firstDay + i) % 7;
    // 2023-01-01 was a Sunday.
    return safeFormat(new Date(2023, 0, 1 + day, 12), lang, { weekday: "short" });
  });

// Cells of a month grid: leading blanks (null) so the 1st lands under its weekday.
export const monthGrid = (year: number, month: number, firstDay: number) => {
  const first = new Date(year, month, 1, 12).getDay();
  const blanks = (first - firstDay + 7) % 7;
  const days = new Date(year, month + 1, 0, 12).getDate();
  return [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: days }, (_, i) => toLocalDate(new Date(year, month, i + 1, 12))),
  ];
};
