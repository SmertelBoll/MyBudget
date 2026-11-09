import type { Period } from "@/api/types";
import { stackSum, type Bucket, type ChartMode } from "@/data/chartBuckets";
import { parseLocalDate } from "@/utils/dates";

// What the bar chart's pieces share: sizes, colors, labels, and which bar a tap means.

export const CHART_COLORS = { income: "#4CAF82", expense: "#F5B731", profit: "#64B5F6", loss: "#FF8A65" };

export type BarPart = "income" | "expense" | "diff";
export type BarSelection = { index: number; part: BarPart };

export type ChartProps = {
  buckets: Bucket[];
  todayIndex: number;
  granularity: Period;
  mode: ChartMode;
  // Stacks in the expense / income view: the category's or tag's color.
  colorOf: (id: string) => string;
  selection: BarSelection | null;
  onSelect: (selection: BarSelection | null) => void;
};

export const BAR_AREA = 200;
export const LABEL_HEIGHT = 40;
export const CHART_HEIGHT = BAR_AREA + 1 + LABEL_HEIGHT;
export const itemWidthFor = (mode: ChartMode) => (mode === "general" ? 66 : 52);
export const GENERAL_BAR = 14;
export const STACKED_BAR = 30;

// Making an Intl formatter is slow on the phone's engine: one per language and format is made and kept.
const formatters = new Map<string, Intl.DateTimeFormat | null>();
export const format = (date: string, lang: string, options: Intl.DateTimeFormatOptions) => {
  const key = `${lang}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat(lang, options);
    } catch {
      formatter = null;
    }
    formatters.set(key, formatter);
  }
  return formatter ? formatter.format(parseLocalDate(date)) : date;
};

const capitalize = (text: string) => (text ? text[0].toLocaleUpperCase() + text.slice(1) : text);

// Two short lines under a bar: "Jul" | "2" + "Nov" | "6" + "Fri"; years show only their number.
export const labels = (start: string, granularity: Period, lang: string): [string, string] => {
  switch (granularity) {
    case "year":
      return [start.slice(0, 4), ""];
    case "month":
      return [capitalize(format(start, lang, { month: "short" })), ""];
    case "week":
      return [format(start, lang, { day: "numeric" }), capitalize(format(start, lang, { month: "short" }))];
    case "day":
      return [format(start, lang, { day: "numeric" }), capitalize(format(start, lang, { weekday: "short" }))];
  }
};

// Under the chart: the years on screen; for days the months too ("October – November 2026"), as the bars only carry
// day numbers.
export const spanText = (buckets: Bucket[], first: number, last: number, granularity: Period, lang: string) => {
  const firstStart = buckets[first]?.range.start ?? "";
  const lastStart = buckets[last]?.range.start ?? firstStart;
  if (!firstStart) return "";
  const [fromYear, toYear] = [firstStart.slice(0, 4), lastStart.slice(0, 4)];
  if (granularity !== "day") return fromYear === toYear ? fromYear : `${fromYear} – ${toYear}`;
  const month = (date: string) => capitalize(format(date, lang, { month: "long" }));
  const monthYear = (date: string) => capitalize(format(date, lang, { month: "long", year: "numeric" }));
  if (firstStart.slice(0, 7) === lastStart.slice(0, 7)) return monthYear(firstStart);
  return fromYear === toYear ? `${month(firstStart)} – ${monthYear(lastStart)}` : `${monthYear(firstStart)} – ${monthYear(lastStart)}`;
};

// Worklets: the canvas calls them on the UI thread while drawing.
export const generalGap = (itemWidth: number) => {
  "worklet";
  return (itemWidth - GENERAL_BAR * 3) / 4;
};
export const generalCenter = (itemWidth: number, position: number) => {
  "worklet";
  const gap = generalGap(itemWidth);
  return gap + position * (GENERAL_BAR + gap) + GENERAL_BAR / 2;
};

export const partValue = (bucket: Bucket, mode: ChartMode, part: BarPart) =>
  mode !== "general" ? stackSum(bucket) : part === "income" ? bucket.income : part === "expense" ? bucket.expense : bucket.income - bucket.expense;

const GENERAL_PARTS: BarPart[] = ["income", "expense", "diff"];

// The bar a tap at `x` (inside the period) means: in the general view the nearest of the three.
export const hitBar = (bucket: Bucket, mode: ChartMode, itemWidth: number, x: number) => {
  if (mode !== "general") return { part: mode as BarPart, center: itemWidth / 2 };
  const step = GENERAL_BAR + generalGap(itemWidth);
  const position = Math.max(0, Math.min(2, Math.round((x - generalCenter(itemWidth, 0)) / step)));
  return { part: GENERAL_PARTS[position], center: generalCenter(itemWidth, position) };
};

export const heightFor = (value: number, peak: number) => (peak > 0 && value > 0 ? Math.min(BAR_AREA, Math.max(2, (value / peak) * BAR_AREA)) : 0);
