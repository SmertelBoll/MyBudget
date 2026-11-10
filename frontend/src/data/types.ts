import type { EntryType } from "@/api/types";

// Records as the app keeps them; the same fields as the backend schemas (backend/validations/entities.js).
// Amounts are integers in minor units (cents); dates are local "YYYY-MM-DD"; times are ISO strings.

type Base = {
  id: string;
  // Set by the server; absent on a record made offline that hasn't synced yet.
  createdAt?: string;
  updatedAt?: string;
};

export type Account = Base & {
  name: string;
  currency: string;
  icon: string;
  color: string;
  includeInTotal: boolean;
  note: string;
  // No longer used: older versions counted the balance from here. Always 0 and the creation time now; balance
  // corrections are entries (Transaction.isCorrection).
  balanceAnchor: number;
  balanceAnchorAt: string;
  sortOrder: number;
  isActive: boolean;
};

export type Category = Base & {
  name: string | null;
  nameKey: string | null;
  type: EntryType;
  icon: string;
  color: string;
  plannedMonthly: number | null;
  sortOrder: number;
  isSystemOther?: boolean;
  // Left out of the pickers and the main list; entries keep it. Missing on categories saved before it existed.
  hidden?: boolean;
};

export type Tag = Base & {
  name: string;
  // Missing on tags saved before they existed. null color: the parent's, or one picked from the id (TagTree.colorOf).
  color?: string | null;
  // A top-level tag this one is a subtag of (one level only).
  parentId?: string | null;
  // Left out of the pickers and the main list, with its subtags (TagTree.isHidden); entries keep it.
  hidden?: boolean;
};

export type Transaction = Base & {
  type: EntryType;
  accountId: string;
  // null only on a balance correction.
  categoryId: string | null;
  // A balance correction (the user typed a balance by hand, or an account's starting balance): it only moves the
  // account's balance, has no category or tags and never shows in lists or statistics. Missing on older entries.
  isCorrection?: boolean;
  tagIds: string[];
  amount: number;
  currency: string;
  accountAmount: number;
  rate: number;
  date: string;
  comment: string;
  photos: string[];
  recurringId: string | null;
  clientCreatedAt: string;
};

// An income or expense the user sees (everything but corrections): it always has a category.
export type Entry = Transaction & { categoryId: string; isCorrection?: false };

export type Transfer = Base & {
  fromAccountId: string;
  toAccountId: string;
  amountFrom: number;
  amountTo: number;
  rate: number;
  date: string;
  comment: string;
  clientCreatedAt: string;
};

export type RepeatRule = {
  kind: "once" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
  every?: number;
  unit?: "day" | "week" | "month";
  weekdays?: number[];
  cron?: string;
};

export type Recurring = Base & {
  type: EntryType;
  name: string;
  rule: RepeatRule;
  autoAdd: boolean;
  startDate: string;
  time: string;
  endDate: string | null;
  accountId: string;
  categoryId: string;
  amount: number;
  currency: string;
  tagIds: string[];
  comment: string;
  notify: boolean;
  // Missing on payments saved before it existed: treat as active (isActivePayment).
  active?: boolean;
  lastGeneratedAt: string | null;
};

export type Reminder = Base & {
  title: string;
  rule: RepeatRule;
  startDate: string;
  time: string;
  comment: string;
  active: boolean;
};

export type EntityMap = {
  accounts: Account;
  categories: Category;
  tags: Tag;
  transactions: Transaction;
  transfers: Transfer;
  recurring: Recurring;
  reminders: Reminder;
};

export type Collection = keyof EntityMap;

export const COLLECTIONS: Collection[] = [
  "accounts",
  "categories",
  "tags",
  "transactions",
  "transfers",
  "recurring",
  "reminders",
];
