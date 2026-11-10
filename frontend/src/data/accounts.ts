import * as Crypto from "expo-crypto";
import { computeBalances } from "./balances";
import { convert } from "./rates";
import { getSnapshot, removeEntities, saveEntity } from "./store";
import { todayLocal } from "@/utils/dates";
import type { Account, Transaction, Transfer } from "./types";

export const sortAccounts = (accounts: Account[]) =>
  [...accounts].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

export const newId = () => Crypto.randomUUID();

const currentBalances = () =>
  computeBalances(getSnapshot("accounts"), getSnapshot("transactions"), getSnapshot("transfers"));

// A hidden entry that moves the account's balance by `delta` (minor units of the account's currency, either sign):
// a balance typed by hand, a starting balance, or keeping a balance when entries it depended on go away.
export const addCorrection = async (account: Pick<Account, "id" | "currency">, delta: number) => {
  if (!delta) return;
  const amount = Math.abs(delta);
  const correction: Transaction = {
    id: newId(),
    type: delta > 0 ? "income" : "expense",
    accountId: account.id,
    categoryId: null,
    isCorrection: true,
    tagIds: [],
    amount,
    currency: account.currency,
    accountAmount: amount,
    rate: 1,
    date: todayLocal(),
    comment: "",
    photos: [],
    recurringId: null,
    clientCreatedAt: new Date().toISOString(),
  };
  await saveEntity("transactions", correction);
};

// Create or edit (screen 5.2). A starting balance, or a balance typed over the current one, becomes a correction for
// the difference; an unchanged balance adds nothing.
// balanceAnchor / balanceAnchorAt are no longer used (older app versions counted from them): always 0 and the
// creation time.
export const saveAccount = async (
  fields: Pick<Account, "name" | "currency" | "icon" | "color" | "includeInTotal" | "note">,
  balance: number,
  existing?: Account
) => {
  if (!existing) {
    const maxOrder = Math.max(-1, ...getSnapshot("accounts").map((account) => account.sortOrder));
    const account: Account = {
      id: newId(),
      ...fields,
      balanceAnchor: 0,
      balanceAnchorAt: new Date().toISOString(),
      sortOrder: maxOrder + 1,
      isActive: true,
    };
    await saveEntity("accounts", account);
    await addCorrection(account, balance);
    return account;
  }

  const delta = balance - (currentBalances().get(existing.id) ?? 0);
  const account: Account = {
    ...existing,
    ...fields,
    // Fixed after creation (spec 2.2).
    currency: existing.currency,
  };
  await saveEntity("accounts", account);
  await addCorrection(account, delta);
  return account;
};

// Moves the whole balance into another account before deletion (spec 5.3, step 2), converted at today's rate.
export const moveBalance = async (from: Account, to: Account, date: string) => {
  const amount = currentBalances().get(from.id) ?? 0;
  if (amount <= 0) return;
  const amountTo = convert(amount, from.currency, to.currency) ?? amount;
  const transfer: Transfer = {
    id: newId(),
    fromAccountId: from.id,
    toAccountId: to.id,
    amountFrom: amount,
    amountTo,
    rate: amountTo / amount,
    date,
    comment: "",
    clientCreatedAt: new Date().toISOString(),
  };
  await saveEntity("transfers", transfer);
};

// "Just remove from the list": the account stays in old transactions, dimmed (spec 5.3).
export const deactivateAccount = (account: Account) => saveEntity("accounts", { ...account, isActive: false });

// "Delete with its transactions" (spec 5.3, Q15): the account, its transactions and every transfer it took part in
// go away for good. The other side of those transfers keeps its current balance: a correction takes the transfer's
// place.
export const deleteAccountWithData = async (account: Account) => {
  const transfers = getSnapshot("transfers").filter(
    (transfer) => transfer.fromAccountId === account.id || transfer.toAccountId === account.id
  );

  const accounts = new Map(getSnapshot("accounts").map((item) => [item.id, item]));
  const corrections = new Map<string, number>();
  for (const transfer of transfers) {
    const otherId = transfer.fromAccountId === account.id ? transfer.toAccountId : transfer.fromAccountId;
    if (!accounts.has(otherId)) continue;
    // The transfer changed the other balance by this much; removing it must not.
    const effect = transfer.toAccountId === otherId ? transfer.amountTo : -transfer.amountFrom;
    corrections.set(otherId, (corrections.get(otherId) ?? 0) + effect);
  }
  for (const [otherId, effect] of corrections) await addCorrection(accounts.get(otherId)!, effect);

  await removeEntities(
    "transactions",
    getSnapshot("transactions")
      .filter((tx) => tx.accountId === account.id)
      .map((tx) => tx.id)
  );
  await removeEntities(
    "transfers",
    transfers.map((transfer) => transfer.id)
  );
  await removeEntities("accounts", [account.id]);
};
