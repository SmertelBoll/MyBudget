import * as Crypto from "expo-crypto";
import { computeBalances } from "./balances";
import { convert } from "./rates";
import { getSnapshot, removeEntities, saveEntity } from "./store";
import type { Account, Transfer } from "./types";

export const sortAccounts = (accounts: Account[]) =>
  [...accounts].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

export const newId = () => Crypto.randomUUID();

const currentBalances = () =>
  computeBalances(getSnapshot("accounts"), getSnapshot("transactions"), getSnapshot("transfers"));

// Create or edit (screen 5.2). Typing a balance by hand moves the anchor to now (spec 5.4); leaving it as it was
// keeps the old anchor, so nothing is recounted.
export const saveAccount = async (
  fields: Pick<Account, "name" | "currency" | "icon" | "color" | "includeInTotal" | "note">,
  balance: number,
  existing?: Account
) => {
  const now = new Date().toISOString();
  if (!existing) {
    const maxOrder = Math.max(-1, ...getSnapshot("accounts").map((account) => account.sortOrder));
    const account: Account = {
      id: newId(),
      ...fields,
      balanceAnchor: balance,
      balanceAnchorAt: now,
      sortOrder: maxOrder + 1,
      isActive: true,
    };
    await saveEntity("accounts", account);
    return account;
  }

  const changed = balance !== (currentBalances().get(existing.id) ?? 0);
  const account: Account = {
    ...existing,
    ...fields,
    // Fixed after creation (spec 2.2).
    currency: existing.currency,
    ...(changed && { balanceAnchor: balance, balanceAnchorAt: now }),
  };
  await saveEntity("accounts", account);
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
// go away for good. The other side of those transfers keeps its current balance: its anchor absorbs the transfer.
export const deleteAccountWithData = async (account: Account) => {
  const transfers = getSnapshot("transfers").filter(
    (transfer) => transfer.fromAccountId === account.id || transfer.toAccountId === account.id
  );

  const accounts = new Map(getSnapshot("accounts").map((item) => [item.id, item]));
  const corrections = new Map<string, number>();
  for (const transfer of transfers) {
    const otherId = transfer.fromAccountId === account.id ? transfer.toAccountId : transfer.fromAccountId;
    const other = accounts.get(otherId);
    if (!other || Date.parse(transfer.clientCreatedAt) <= Date.parse(other.balanceAnchorAt)) continue;
    // The transfer changed the other balance by this much; removing it must not.
    const effect = transfer.toAccountId === otherId ? transfer.amountTo : -transfer.amountFrom;
    corrections.set(otherId, (corrections.get(otherId) ?? 0) + effect);
  }
  for (const [otherId, effect] of corrections) {
    const other = accounts.get(otherId)!;
    await saveEntity("accounts", { ...other, balanceAnchor: other.balanceAnchor + effect });
  }

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
