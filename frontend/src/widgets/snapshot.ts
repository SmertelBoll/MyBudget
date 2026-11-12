import type { EntryType, User } from "@/api/types";
import { computeBalances } from "@/data/balances";
import { categoryName } from "@/data/categories";
import { visibleEntries } from "@/data/hooks";
import { convert, type Rates } from "@/data/rates";
import { inBaseCurrency } from "@/data/stats";
import type { Account, Category, Transaction, Transfer } from "@/data/types";
import { readJson, writeJson } from "@/storage/json";
import { storage } from "@/storage/storage";
import { formatMoney, type MoneyFormat } from "@/utils/money";
import { centsSettings } from "@/utils/useMoney";

// Home-screen widgets never work anything out: the app (or the hourly background sync) leaves them this snapshot,
// already formatted, and they only draw it. So a widget is right even when the app hasn't run since a reboot.

export type WidgetTop = { name: string; color: string; amount: string; share: number };

// One thing a widget can show: Total or one account.
export type WidgetScope = {
  key: string; // "total" or the account id
  name: string;
  color: string;
  balance: string;
  // This month's expenses or income (whichever the user focuses on, Settings -> Focus) and its biggest categories.
  month: string;
  top: WidgetTop[];
};

export type WidgetSnapshot = {
  version: 1;
  updatedAt: string;
  total: WidgetScope;
  accounts: WidgetScope[];
  // "Spent this month" or "Received this month", already in the user's language.
  monthLabel: string;
  // Words the widgets and their setup screen need, in the user's language. The background sync also translates
  // default category names from here, as it has no dictionary of its own.
  i18n: Record<string, string>;
};

export const TOTAL = "total";
const SNAPSHOT_KEY = "widgets.snapshot";
const SELECTION_KEY = (widgetId: number) => `widgets.selection.${widgetId}`;

export const readSnapshot = () => readJson<WidgetSnapshot>(SNAPSHOT_KEY);
export const writeSnapshot = (snapshot: WidgetSnapshot) => writeJson(SNAPSHOT_KEY, snapshot);

// What each widget on the home screen shows: Total and / or accounts, in the user's order. The first is shown big,
// the rest smaller under it, as many as fit. (Earlier versions stored a single key, then { main, second }.)
export type Selection = string[];
export const readSelection = async (widgetId: number): Promise<Selection> => {
  const stored = await readJson<string | string[] | { main?: string; second?: string | null }>(SELECTION_KEY(widgetId));
  if (!stored) return [TOTAL];
  if (typeof stored === "string") return [stored];
  if (Array.isArray(stored)) return stored.length ? stored : [TOTAL];
  return [stored.main ?? TOTAL, ...(stored.second ? [stored.second] : [])];
};
export const writeSelection = (widgetId: number, selection: Selection) => writeJson(SELECTION_KEY(widgetId), selection);
export const removeSelection = (widgetId: number) => storage.remove(SELECTION_KEY(widgetId));

export const LABEL_KEYS = [
  "home.total",
  "widget.accountGone",
  "widget.empty",
  "widget.chooseTitle",
  "widget.chooseHint",
  "widget.chooseAccounts",
  "widget.orderHint",
  "widget.shown",
  "widget.add",
  "widget.done",
  "widget.remove",
  "common.cancel",
];

const TOTAL_COLOR = "#F9F919";
// The most categories a stretched 4×2 widget can list (it shows as many as fit, five at two cells tall).
const TOP_COUNT = 12;

type Inputs = {
  user: User;
  lang: string;
  t: (key: string) => string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  transfers: Transfer[];
  rates: Rates;
  today: string; // YYYY-MM-DD
};

export const buildSnapshot = ({ user, lang, t, accounts, categories, transactions, transfers, rates, today }: Inputs): WidgetSnapshot => {
  const base = user.baseCurrency ?? "USD";
  // Widgets have their own Cents switch; it is on unless turned off.
  const format: MoneyFormat = {
    lang,
    decimalSeparator: user.settings.decimalSeparator ?? ".",
    ...centsSettings(user.settings),
    centsInTotals: user.settings.centsInWidgets ?? true,
  };
  const money = (minor: number, currency: string) => formatMoney(minor, currency, format);

  const balances = computeBalances(accounts, transactions, transfers);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const month = today.slice(0, 7);
  // The month line follows Settings -> Focus: expenses or income.
  const focus = user.settings.focus === "income" ? "income" : "expense";
  const spent = visibleEntries(transactions).filter((tx) => tx.type === focus && tx.date.slice(0, 7) === month);

  // This month's total and the biggest categories, from entries already in the scope's currency.
  const spending = (values: { categoryId: string; value: number }[], currency: string) => {
    const total = values.reduce((sum, item) => sum + item.value, 0);
    const byCategory = new Map<string, number>();
    for (const { categoryId, value } of values) byCategory.set(categoryId, (byCategory.get(categoryId) ?? 0) + value);
    const top = [...byCategory]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_COUNT)
      .map(([id, value]) => {
        const category = categoryById.get(id);
        return { name: category ? categoryName(category, t) : "?", color: category?.color ?? "#9e9e9e", amount: money(value, currency), share: total ? value / total : 0 };
      });
    return { month: money(total, currency), top };
  };

  // Total as on Home: active accounts counted in Total, in the main currency at today's rate. Its spending, like
  // Home's with Total chosen, covers every account.
  let totalBalance = 0;
  for (const account of accounts) {
    if (!account.isActive || !account.includeInTotal) continue;
    totalBalance += convert(balances.get(account.id) ?? 0, account.currency, base, rates) ?? 0;
  }
  const total: WidgetScope = {
    key: TOTAL,
    name: t("home.total"),
    color: TOTAL_COLOR,
    balance: money(totalBalance, base),
    ...spending(
      spent.map((tx) => ({ categoryId: tx.categoryId, value: inBaseCurrency(tx, accountById, base, rates) })),
      base
    ),
  };

  const scopes = accounts
    .filter((account) => account.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((account) => ({
      key: account.id,
      name: account.name,
      color: account.color,
      balance: money(balances.get(account.id) ?? 0, account.currency),
      ...spending(
        spent.filter((tx) => tx.accountId === account.id).map((tx) => ({ categoryId: tx.categoryId, value: tx.accountAmount })),
        account.currency
      ),
    }));

  const keys = [...LABEL_KEYS, ...categories.flatMap((category) => (category.nameKey ? [category.nameKey] : []))];
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    total,
    accounts: scopes,
    monthLabel: t(focus === "income" ? "widget.receivedMonth" : "widget.spentMonth"),
    i18n: Object.fromEntries(keys.map((key) => [key, t(key)])),
  };
};

// A tap opens a new entry (the user's usual type, or the one asked for) over Home: see app/(app)/from-widget.tsx.
export const newEntryUri = (type?: EntryType) => `mybudget://from-widget${type ? `?type=${type}` : ""}`;
