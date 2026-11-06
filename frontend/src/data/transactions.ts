import { newId } from "./accounts";
import { getMeta, removeEntity, saveEntity, setMeta } from "./store";
import type { Recurring, Transaction } from "./types";

export type TransactionFields = Pick<
  Transaction,
  "type" | "accountId" | "categoryId" | "tagIds" | "amount" | "currency" | "accountAmount" | "rate" | "date" | "comment" | "photos"
>;

// Screen 4. A new entry is stamped with the device time: the balance rule compares it with the account's anchor
// (spec 5.4), so an entry for last week still changes today's balance.
export const saveTransaction = async (fields: TransactionFields, existing?: Transaction) => {
  const transaction: Transaction = {
    ...existing,
    id: existing?.id ?? newId(),
    ...fields,
    recurringId: existing?.recurringId ?? null,
    clientCreatedAt: existing?.clientCreatedAt ?? new Date().toISOString(),
  };
  await saveEntity("transactions", transaction);
  rememberDate(fields.date);
  return transaction;
};

export const deleteTransaction = (id: string) => removeEntity("transactions", id);

// Spec 4.5, future date -> "one-time regular payment": no transaction now; a payment that turns into one on that
// date (auto-add on, 09:00 by default). Photos don't carry over (payments have none).
export const createOneTimePayment = async (
  fields: Omit<TransactionFields, "photos" | "rate" | "currency" | "amount"> & { name: string; notify: boolean; accountCurrency: string }
) => {
  const payment: Recurring = {
    id: newId(),
    type: fields.type,
    name: fields.name,
    rule: { kind: "once" },
    autoAdd: true,
    startDate: fields.date,
    time: "09:00",
    endDate: null,
    accountId: fields.accountId,
    categoryId: fields.categoryId,
    // In the account's currency (spec 8.3).
    amount: fields.accountAmount,
    currency: fields.accountCurrency,
    tagIds: fields.tagIds,
    comment: fields.comment,
    notify: fields.notify,
    lastGeneratedAt: null,
  };
  await saveEntity("recurring", payment);
  rememberDate(fields.date);
  return payment;
};

// Spec 4.5: the third date button offers the date the user last added an entry (or a one-time payment) for. Kept
// in the local meta table, so it survives a restart; cleared with the rest of the local data on a user switch.
const LAST_DATE_KEY = "lastEntryDate";
let lastUsedDate: string | null = null;

const rememberDate = (date: string) => {
  lastUsedDate = date;
  setMeta({ [LAST_DATE_KEY]: date }).catch(() => {});
};

export const loadLastUsedDate = async () => {
  lastUsedDate = await getMeta(LAST_DATE_KEY);
};

export const getLastUsedDate = () => lastUsedDate;
