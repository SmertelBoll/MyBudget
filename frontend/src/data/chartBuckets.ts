import { useMemo } from "react";
import type { EntryType, Period } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { addDays, todayLocal } from "@/utils/dates";
import { periodContaining, type PeriodRange } from "@/utils/periods";
import { useCollection } from "./hooks";
import { useRates } from "./rates";
import { NO_TAG, inBaseCurrency, type AccountFilter } from "./stats";
import { buildTagTree, rootsOf } from "./tags";

export type ChartMode = "general" | EntryType;
export type Stack = { id: string; value: number };
export type Bucket = { range: PeriodRange; income: number; expense: number; stacks: Stack[] };

// Spec 6: one bar (or three) per period, all in the main currency at today's rate. In the expense / income view a
// bar is split by category or by tag, biggest part at the bottom. By tag an entry counts in full in each of its tags
// (as on Home), so such a bar can be taller than the period's total; the screen says so.
export const useChartBuckets = (filter: AccountFilter, granularity: Period, mode: ChartMode, by: "category" | "tag") => {
  const transactions = useCollection("transactions");
  const accounts = useCollection("accounts");
  const tags = useCollection("tags");
  const rates = useRates();
  const { user } = useAuth();
  const base = user?.baseCurrency ?? "USD";
  const firstDay = user?.settings.firstDayOfWeek ?? 1;

  return useMemo(() => {
    const today = todayLocal();
    const allowed = filter ? new Set(filter) : null;
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const tree = buildTagTree(tags);
    const entries = transactions.filter((tx) => !allowed || allowed.has(tx.accountId));

    const shift = (range: PeriodRange, steps: number) => {
      let current = range;
      for (let i = 0; i < Math.abs(steps); i++) {
        current = periodContaining(granularity, steps < 0 ? addDays(current.start, -1) : addDays(current.end, 1), firstDay);
      }
      return current;
    };
    const earliest = entries.reduce((min, tx) => (tx.date < min ? tx.date : min), today);
    const latest = entries.reduce((max, tx) => (tx.date > max ? tx.date : max), today);
    const first = periodContaining(granularity, earliest, firstDay);
    const last = periodContaining(granularity, latest, firstDay);
    const todayStart = periodContaining(granularity, today, firstDay).start;

    const buckets: (Bucket & { stackMap: Map<string, number> })[] = [];
    const index = new Map<string, number>();
    for (let range = first; range.start <= last.start; range = shift(range, 1)) {
      index.set(range.start, buckets.length);
      buckets.push({ range, income: 0, expense: 0, stacks: [], stackMap: new Map() });
    }

    for (const tx of entries) {
      const bucket = buckets[index.get(periodContaining(granularity, tx.date, firstDay).start) ?? -1];
      if (!bucket) continue;
      const value = inBaseCurrency(tx, accountById, base, rates);
      if (tx.type === "income") bucket.income += value;
      else bucket.expense += value;
      if (mode === "general" || tx.type !== mode) continue;
      // By tag: a subtag counts in its top-level tag.
      const ids = by === "category" ? [tx.categoryId] : rootsOf(tx.tagIds, tree);
      for (const id of ids.length ? ids : [NO_TAG]) bucket.stackMap.set(id, (bucket.stackMap.get(id) ?? 0) + value);
    }

    return {
      todayIndex: index.get(todayStart) ?? buckets.length - 1,
      buckets: buckets.map(({ stackMap, ...bucket }) => ({
        ...bucket,
        // column-reverse in the bar: the first stack is drawn at the bottom.
        stacks: [...stackMap].map(([id, value]) => ({ id, value })).sort((a, b) => b.value - a.value),
      })),
    };
  }, [transactions, accounts, tags, rates, base, firstDay, filter, granularity, mode, by]);
};

// Height of a stacked bar: the sum of its parts (by tag that can be more than the period's total).
export const stackSum = (bucket: Bucket) => bucket.stacks.reduce((sum, stack) => sum + stack.value, 0);

// The value a bar is scaled by: for the general view the tallest of its three bars.
export const bucketPeak = (bucket: Bucket, mode: ChartMode) =>
  mode === "general" ? Math.max(bucket.income, bucket.expense, Math.abs(bucket.income - bucket.expense)) : stackSum(bucket);
