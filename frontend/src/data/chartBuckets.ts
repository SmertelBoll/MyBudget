import { useMemo } from "react";
import type { EntryType, Period } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { addDays, todayLocal } from "@/utils/dates";
import { periodContaining, type PeriodRange } from "@/utils/periods";
import { useCollection } from "./hooks";
import { useRates } from "./rates";
import { NO_TAG, inBaseCurrency, type AccountFilter } from "./stats";

export type ChartMode = "general" | EntryType;
export type Stack = { id: string; value: number };
export type Bucket = { range: PeriodRange; income: number; expense: number; stacks: Stack[] };

// Spec 6: one bar (or three) per period, from the first entry to today, all in the main currency at today's rate.
// In the expense / income view a bar is split by category, or by tag; an entry with several tags is shared evenly
// between them so the bar still adds up to the period's total.
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
    const knownTags = new Set(tags.map((tag) => tag.id));
    const entries = transactions.filter((tx) => tx.date <= today && (!allowed || allowed.has(tx.accountId)));

    const earliest = entries.reduce((min, tx) => (tx.date < min ? tx.date : min), today);
    const buckets: (Bucket & { stackMap: Map<string, number> })[] = [];
    const index = new Map<string, number>();
    for (let range = periodContaining(granularity, earliest, firstDay); range.start <= today; ) {
      index.set(range.start, buckets.length);
      buckets.push({ range, income: 0, expense: 0, stacks: [], stackMap: new Map() });
      range = periodContaining(granularity, addDays(range.end, 1), firstDay);
    }

    // Stacks are ordered the same way in every bar: the biggest group over all time at the bottom.
    const overall = new Map<string, number>();
    for (const tx of entries) {
      const bucket = buckets[index.get(periodContaining(granularity, tx.date, firstDay).start) ?? -1];
      if (!bucket) continue;
      const value = inBaseCurrency(tx, accountById, base, rates);
      if (tx.type === "income") bucket.income += value;
      else bucket.expense += value;
      if (mode === "general" || tx.type !== mode) continue;
      const ids = by === "category" ? [tx.categoryId] : tx.tagIds.filter((id) => knownTags.has(id));
      const parts = ids.length ? ids : [NO_TAG];
      for (const id of parts) {
        const share = value / parts.length;
        bucket.stackMap.set(id, (bucket.stackMap.get(id) ?? 0) + share);
        overall.set(id, (overall.get(id) ?? 0) + share);
      }
    }
    const rank = new Map([...overall].sort((a, b) => b[1] - a[1]).map(([id], position) => [id, position]));
    return buckets.map(({ stackMap, ...bucket }) => ({
      ...bucket,
      stacks: [...stackMap]
        .map(([id, value]) => ({ id, value }))
        .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)),
    }));
  }, [transactions, accounts, tags, rates, base, firstDay, filter, granularity, mode, by]);
};

// The value a bar is scaled by: for the general view the tallest of its three bars.
export const bucketPeak = (bucket: Bucket, mode: ChartMode) =>
  mode === "general"
    ? Math.max(bucket.income, bucket.expense, Math.abs(bucket.income - bucket.expense))
    : mode === "income"
      ? bucket.income
      : bucket.expense;
