import { useMemo } from "react";
import { parseLocalDate, todayLocal } from "@/utils/dates";
import { useEntries } from "./hooks";
import type { Tag } from "./types";

// Spec 4.6, tag order: most likely first. A "frecency" score (frequency and recency, as in Firefox's address bar):
// every use of a tag adds a weight that halves every HALF_LIFE_DAYS, so a few uses in the last two weeks outweigh
// many from months ago. With a category chosen, its own scores decide first; the overall score breaks ties
// (including tags never used with that category), then the name.
const HALF_LIFE_DAYS = 14;
const DAY_MS = 86_400_000;

type Scores = { overall: Map<string, number>; byCategory: Map<string, Map<string, number>> };

const useTagScores = (): Scores => {
  const transactions = useEntries();
  return useMemo(() => {
    const today = parseLocalDate(todayLocal()).getTime();
    const overall = new Map<string, number>();
    const byCategory = new Map<string, Map<string, number>>();
    for (const tx of transactions) {
      if (!tx.tagIds.length) continue;
      const age = Math.max(0, (today - parseLocalDate(tx.date).getTime()) / DAY_MS);
      const weight = Math.pow(0.5, age / HALF_LIFE_DAYS);
      let inCategory = byCategory.get(tx.categoryId);
      if (!inCategory) byCategory.set(tx.categoryId, (inCategory = new Map()));
      for (const tagId of tx.tagIds) {
        overall.set(tagId, (overall.get(tagId) ?? 0) + weight);
        inCategory.set(tagId, (inCategory.get(tagId) ?? 0) + weight);
      }
    }
    return { overall, byCategory };
  }, [transactions]);
};

// Tags in the order to offer them for this category (or for the whole app with none chosen).
export const useRankedTags = (tags: Tag[], categoryId: string | null, lang: string) => {
  const { overall, byCategory } = useTagScores();
  return useMemo(() => {
    const own = categoryId ? byCategory.get(categoryId) : undefined;
    const collator = new Intl.Collator(lang);
    return [...tags].sort(
      (a, b) =>
        (own?.get(b.id) ?? 0) - (own?.get(a.id) ?? 0) ||
        (overall.get(b.id) ?? 0) - (overall.get(a.id) ?? 0) ||
        collator.compare(a.name, b.name)
    );
  }, [tags, categoryId, lang, overall, byCategory]);
};
