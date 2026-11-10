import { useMemo } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useCollection } from "./hooks";
import { convert, useRates } from "./rates";
import type { Account, Transaction, Transfer } from "./types";

// Balance = every income, expense (balance corrections included) and transfer of the account, whatever its date. A
// balance typed by hand is a correction entry for the difference (accounts.ts), not a new starting point.
// The collections are new arrays whenever they change, so the last result can be reused while they stay the same:
// every screen that shows balances (forms, pickers, Home) mounts without going through all entries again.
let cached: { accounts: Account[]; transactions: Transaction[]; transfers: Transfer[]; result: Map<string, number> } | null = null;

// Settings -> Recalculate balance: the next read works everything out again.
export const resetBalanceCache = () => {
  cached = null;
};

export const computeBalances = (accounts: Account[], transactions: Transaction[], transfers: Transfer[]) => {
  if (cached && cached.accounts === accounts && cached.transactions === transactions && cached.transfers === transfers) {
    return cached.result;
  }
  const result = computeFresh(accounts, transactions, transfers);
  cached = { accounts, transactions, transfers, result };
  return result;
};

const computeFresh = (accounts: Account[], transactions: Transaction[], transfers: Transfer[]) => {
  const balances = new Map(accounts.map((account) => [account.id, 0]));
  const add = (accountId: string, delta: number) => {
    if (balances.has(accountId)) balances.set(accountId, balances.get(accountId)! + delta);
  };
  for (const tx of transactions) add(tx.accountId, tx.type === "income" ? tx.accountAmount : -tx.accountAmount);
  for (const transfer of transfers) {
    add(transfer.fromAccountId, -transfer.amountFrom);
    add(transfer.toAccountId, transfer.amountTo);
  }
  return balances;
};

export const useBalances = () => {
  const accounts = useCollection("accounts");
  const transactions = useCollection("transactions");
  const transfers = useCollection("transfers");
  return useMemo(() => computeBalances(accounts, transactions, transfers), [accounts, transactions, transfers]);
};

export type Totals = { included: number; excluded: number; all: number; currency: string };

// Screen 5.1 / spec 2.1: Total counts only active accounts marked "include in Total", in the main currency at
// today's rate (Q4). "All" adds the excluded ones. Inactive (removed from the list) accounts don't count.
export const useTotals = (): Totals => {
  const accounts = useCollection("accounts");
  const balances = useBalances();
  const rates = useRates();
  const { user } = useAuth();
  const currency = user?.baseCurrency ?? "USD";

  return useMemo(() => {
    let included = 0;
    let excluded = 0;
    for (const account of accounts) {
      if (!account.isActive) continue;
      const value = convert(balances.get(account.id) ?? 0, account.currency, currency, rates) ?? 0;
      if (account.includeInTotal) included += value;
      else excluded += value;
    }
    return { included, excluded, all: included + excluded, currency };
  }, [accounts, balances, rates, currency]);
};
