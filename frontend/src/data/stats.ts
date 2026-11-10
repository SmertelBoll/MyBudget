import { useMemo } from "react";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { inPeriod, type PeriodRange } from "@/utils/periods";
import { useCollection, useEntries } from "./hooks";
import { convert, useRates, type Rates } from "./rates";
import { rootsOf, type TagTree } from "./tags";
import type { Account, Entry, Transaction } from "./types";

// null = Total: every account, whether or not it counts in the Total balance (Q3).
export type AccountFilter = string[] | null;

export const NO_TAG = "--no-tag--";

export type Breakdown = { id: string; amount: number };
// childBy: what the lines inside a row are. A tag with subtags opens to them; the line with the tag's own id holds
// entries with that tag but none of its subtags.
export type Group = { id: string; amount: number; share: number; children: Breakdown[]; childBy: "category" | "tag" };

// An entry in the main currency at today's rate (like Total, spec 2.2). The account's amount is used when the
// account is known, otherwise the entry's own amount.
export const inBaseCurrency = (tx: Transaction, accounts: Map<string, Account>, base: string, rates: Rates) => {
  const account = accounts.get(tx.accountId);
  const value = account ? convert(tx.accountAmount, account.currency, base, rates) : convert(tx.amount, tx.currency, base, rates);
  return value ?? 0;
};

export const filterTransactions = (
  transactions: Entry[],
  { type, accountIds, range }: { type: EntryType; accountIds: AccountFilter; range: PeriodRange }
) => {
  const allowed = accountIds ? new Set(accountIds) : null;
  return transactions.filter(
    (tx) => tx.type === type && inPeriod(tx.date, range) && (!allowed || allowed.has(tx.accountId))
  );
};

// The top-level tags an entry counts in (a subtag counts in its parent), or "no tag".
const rootTagsOf = (tx: Entry, tree: TagTree) => {
  const roots = rootsOf(tx.tagIds, tree);
  return roots.length ? roots : [NO_TAG];
};

const sorted = (map: Map<string, number>) =>
  [...map].map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount);

// Spec 2.3: rows by category (opened: by tag) or by top-level tag (opened: by subtag, or by category for a tag with
// no subtags). An entry with several tags counts in each of its tags; the total counts it once, so tag shares may
// add up to more than 100 %.
export const groupEntries = (
  entries: { tx: Entry; value: number }[],
  by: "category" | "tag",
  tree: TagTree
): { total: number; groups: Group[] } => {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const groups = new Map<string, { amount: number; children: Map<string, number> }>();
  const group = (id: string) => {
    let found = groups.get(id);
    if (!found) groups.set(id, (found = { amount: 0, children: new Map() }));
    return found;
  };
  const addChild = (target: Map<string, number>, id: string, value: number) => target.set(id, (target.get(id) ?? 0) + value);
  for (const { tx, value } of entries) {
    const roots = rootTagsOf(tx, tree);
    if (by === "category") {
      // Once in its category; inside it, once in each of its top-level tags.
      const target = group(tx.categoryId);
      target.amount += value;
      for (const tagId of roots) addChild(target.children, tagId, value);
    } else {
      for (const root of roots) {
        const target = group(root);
        target.amount += value;
        if (!tree.children.get(root)?.length) {
          addChild(target.children, tx.categoryId, value);
          continue;
        }
        const subtags = tx.tagIds.filter((id) => id !== root && tree.rootOf(id) === root);
        for (const id of subtags.length ? subtags : [root]) addChild(target.children, id, value);
      }
    }
  }
  const result = [...groups].map(([id, { amount, children }]) => ({
    id,
    amount,
    share: total ? amount / total : 0,
    children: sorted(children),
    childBy: (by === "category" || tree.children.get(id)?.length ? "tag" : "category") as Group["childBy"],
  }));
  return { total, groups: result.sort((a, b) => b.amount - a.amount) };
};

// Entries of the chosen accounts, type and period, each with its amount in the main currency.
export const usePeriodEntries = (type: EntryType, accountIds: AccountFilter, range: PeriodRange) => {
  const transactions = useEntries();
  const accounts = useCollection("accounts");
  const rates = useRates();
  const { user } = useAuth();
  const base = user?.baseCurrency ?? "USD";
  return useMemo(() => {
    const byId = new Map(accounts.map((account) => [account.id, account]));
    return filterTransactions(transactions, { type, accountIds, range }).map((tx) => ({
      tx,
      value: inBaseCurrency(tx, byId, base, rates),
    }));
  }, [transactions, accounts, rates, base, type, accountIds, range]);
};
