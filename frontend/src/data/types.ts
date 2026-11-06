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
};

export type Tag = Base & {
  name: string;
};

export type Transaction = Base & {
  type: EntryType;
  accountId: string;
  categoryId: string;
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
