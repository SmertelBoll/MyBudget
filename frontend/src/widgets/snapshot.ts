import type { EntryType, User } from "@/api/types";
import { computeBalances } from "@/data/balances";
import { categoryName } from "@/data/categories";
import { visibleEntries } from "@/data/hooks";
import { convert, rateBetween, type Rates } from "@/data/rates";
import { isActivePayment } from "@/data/recurring";
import { inBaseCurrency } from "@/data/stats";
import type { Account, Category, Recurring, Reminder, Transaction, Transfer } from "@/data/types";
import { readJson, writeJson } from "@/storage/json";
import { storage } from "@/storage/storage";
import { addDays, formatShortDate } from "@/utils/dates";
import { formatMoney, type MoneyFormat } from "@/utils/money";
import { periodContaining } from "@/utils/periods";
import { atMinute, nextOccurrence, type Occurrence } from "@/utils/schedule";
import { centsSettings } from "@/utils/useMoney";

// Home-screen widgets never work anything out: the app (or the hourly background sync) leaves them this snapshot,
// every line already worked out and formatted, and they only draw it. So a widget is right even when the app hasn't
// run since a reboot.

// good / bad: the value is drawn green / red (spending down, a limit kept; income down, a limit broken...).
export type Tone = "good" | "bad" | null;

// One line a widget can show: a label (an account's name, "Spent this week"...) and its value.
export type WidgetItem = { key: string; label: string; value: string; color: string; tone: Tone };

export type GroupKey = "totals" | "accounts" | "expense" | "income" | "other";
export type WidgetGroup = { key: GroupKey; title: string; keys: string[] };

export type WidgetTop = { name: string; color: string; amount: string; share: number };

export type WidgetSnapshot = {
  version: 2;
  updatedAt: string;
  items: Record<string, WidgetItem>;
  // What the setup screen offers, group by group.
  groups: WidgetGroup[];
  // This month's biggest categories, for the right side of 4×2.
  top: { expense: WidgetTop[]; income: WidgetTop[] };
  // Words the widgets and their setup screen need, in the user's language. The background sync also translates
  // default category names from here, as it has no dictionary of its own.
  i18n: Record<string, string>;
};

// Keys of the three totals; "total" is the Total of Home (accounts counted in it), as it always was.
export const TOTAL = "total";
export const TOTAL_ALL = "total:all";
export const TOTAL_EXCLUDED = "total:excluded";

const SNAPSHOT_KEY = "widgets.snapshot";
const SELECTION_KEY = (widgetId: number) => `widgets.selection.${widgetId}`;

// Snapshots from older app versions are not read: the app writes a new one as soon as it opens.
export const readSnapshot = async () => {
  const snapshot = await readJson<WidgetSnapshot>(SNAPSHOT_KEY);
  return snapshot?.version === 2 ? snapshot : null;
};
export const writeSnapshot = (snapshot: WidgetSnapshot) => writeJson(SNAPSHOT_KEY, snapshot);

// What each widget shows: lines in the user's order (the first big, the rest smaller, as many as fit) and, on 4×2,
// whether the categories on the right are expenses or income. Older versions stored one key, a list, or
// { main, second }: all still read.
export type Selection = { items: string[]; side: EntryType };
export const readSelection = async (widgetId: number): Promise<Selection> => {
  const stored = await readJson<unknown>(SELECTION_KEY(widgetId));
  const fallback: Selection = { items: [TOTAL], side: "expense" };
  if (!stored) return fallback;
  if (typeof stored === "string") return { ...fallback, items: [stored] };
  if (Array.isArray(stored)) return { ...fallback, items: stored.length ? (stored as string[]) : fallback.items };
  const object = stored as { items?: string[]; side?: string; main?: string; second?: string | null };
  if (Array.isArray(object.items)) return { items: object.items, side: object.side === "income" ? "income" : "expense" };
  return { ...fallback, items: [object.main ?? TOTAL, ...(object.second ? [object.second] : [])] };
};
export const writeSelection = (widgetId: number, selection: Selection) => writeJson(SELECTION_KEY(widgetId), selection);
export const removeSelection = (widgetId: number) => storage.remove(SELECTION_KEY(widgetId));

export const LABEL_KEYS = [
  "home.total",
  "accounts.summary",
  "accounts.excluded",
  "dates.today",
  "dates.yesterday",
  "widget.tomorrow",
  "widget.accountGone",
  "widget.empty",
  "widget.chooseTitle",
  "widget.chooseHint",
  "widget.chooseAccounts",
  "widget.orderHint",
  "widget.shown",
  "widget.done",
  "widget.remove",
  "widget.side",
  "widget.group.totals",
  "widget.group.accounts",
  "widget.group.expense",
  "widget.group.income",
  "widget.group.other",
  "entries.expenses",
  "entries.income",
  "common.cancel",
];

const COLORS = { [TOTAL_ALL]: "#F9F919", [TOTAL]: "#FFD54F", [TOTAL_EXCLUDED]: "#9E9E9E", expense: "#EF5350", income: "#66BB6A", other: "#90A4AE" };
// The most categories a stretched 4×2 widget can list (it shows as many as fit, five at two cells tall).
const TOP_COUNT = 12;
const METRICS = ["month", "week", "today", "avg", "vs"];
const OTHER = ["payment", "limitsOver", "limitsLeft", "result", "balanceChange", "last", "rate", "noSpend", "reminder"];

type Inputs = {
  user: User;
  lang: string;
  t: (key: string) => string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  transfers: Transfer[];
  recurring: Recurring[];
  reminders: Reminder[];
  rates: Rates;
  now: Date;
};

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

type Schedule = { rule: Recurring["rule"]; startDate: string; time: string; endDate?: string | null };

// The schedule that comes up next, with its occurrence.
const soonest = (schedules: Schedule[], now: Date) => {
  let best: { index: number; at: Occurrence } | null = null;
  schedules.forEach((schedule, index) => {
    const at = nextOccurrence(schedule, atMinute(now));
    if (at && (!best || at.date < best.at.date || (at.date === best.at.date && at.time < best.at.time))) best = { index, at };
  });
  return best as { index: number; at: Occurrence } | null;
};

export const buildSnapshot = ({ user, lang, t, accounts, categories, transactions, transfers, recurring, reminders, rates, now }: Inputs): WidgetSnapshot => {
  const base = user.baseCurrency ?? "USD";
  // Widgets have their own Cents switch; it is on unless turned off.
  const format: MoneyFormat = { lang, decimalSeparator: user.settings.decimalSeparator ?? ".", ...centsSettings(user.settings), centsInTotals: user.settings.centsInWidgets ?? true };
  const money = (minor: number, currency = base) => formatMoney(minor, currency, format);
  const signed = (minor: number) => `${minor > 0 ? "+" : minor < 0 ? "−" : ""}${money(Math.abs(minor))}`;
  const items: Record<string, WidgetItem> = {};
  const add = (item: WidgetItem) => {
    items[item.key] = item;
  };

  const today = localDate(now);
  const dayOfMonth = now.getDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = periodContaining("week", today, user.settings.firstDayOfWeek ?? 1).start;
  const tomorrow = addDays(today, 1);
  const dayWord = (date: string) =>
    date === today ? t("dates.today") : date === tomorrow ? t("widget.tomorrow") : date === addDays(today, -1) ? t("dates.yesterday") : formatShortDate(date, lang);

  const balances = computeBalances(accounts, transactions, transfers);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const entries = visibleEntries(transactions);
  const value = (tx: Transaction) => inBaseCurrency(tx, accountById, base, rates);
  // Everything below counts every account (expenses, income, limits...), in the main currency at today's rate.
  const sum = (type: EntryType, from: string, to: string) =>
    entries.reduce((total, tx) => (tx.type === type && tx.date >= from && tx.date <= to ? total + value(tx) : total), 0);

  // ---- Totals and accounts: a name and a balance.
  const totalOver = (key: string, label: string, counts: (account: Account) => boolean) => {
    let balance = 0;
    for (const account of accounts) {
      if (!account.isActive || !counts(account)) continue;
      balance += convert(balances.get(account.id) ?? 0, account.currency, base, rates) ?? 0;
    }
    add({ key, label, value: money(balance), color: COLORS[key as keyof typeof COLORS], tone: null });
  };
  totalOver(TOTAL_ALL, t("accounts.summary"), () => true);
  totalOver(TOTAL, t("home.total"), (account) => account.includeInTotal);
  totalOver(TOTAL_EXCLUDED, t("accounts.excluded"), (account) => !account.includeInTotal);
  const active = accounts.filter((account) => account.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  for (const account of active) {
    add({ key: account.id, label: account.name, value: money(balances.get(account.id) ?? 0, account.currency), color: account.color, tone: null });
  }

  // ---- Expenses and income: this month, week, today, a day on average, against the same days of last month.
  const lastMonthStart = localDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const lastMonthSameDay = `${lastMonthStart.slice(0, 8)}${String(Math.min(dayOfMonth, lastMonthDays)).padStart(2, "0")}`;
  const metrics = (type: EntryType, prefix: "exp" | "inc") => {
    const color = type === "expense" ? COLORS.expense : COLORS.income;
    const month = sum(type, monthStart, today);
    add({ key: `${prefix}:month`, label: t(`widget.${prefix}.month`), value: money(month), color, tone: null });
    add({ key: `${prefix}:week`, label: t(`widget.${prefix}.week`), value: money(sum(type, weekStart, today)), color, tone: null });
    add({ key: `${prefix}:today`, label: t(`widget.${prefix}.today`), value: money(sum(type, today, today)), color, tone: null });
    add({ key: `${prefix}:avg`, label: t(`widget.${prefix}.avg`), value: money(Math.round(month / dayOfMonth)), color, tone: null });
    // Same stretch of last month (1st–12th against 1st–12th), so the start of a month doesn't read as "−90 %".
    const before = sum(type, lastMonthStart, lastMonthSameDay);
    const change = before ? Math.round(((month - before) / before) * 100) : null;
    add({
      key: `${prefix}:vs`,
      label: t(`widget.${prefix}.vs`),
      value: change === null ? "—" : `${change > 0 ? "↑ " : change < 0 ? "↓ " : ""}${Math.abs(change)} %`,
      color,
      // More spending is bad, more income good.
      tone: !change ? null : (type === "expense") === change > 0 ? "bad" : "good",
    });
    return month;
  };
  const spentMonth = metrics("expense", "exp");
  const receivedMonth = metrics("income", "inc");

  // ---- Other.
  const other = COLORS.other;

  // The nearest regular payment.
  const payments = recurring.filter(isActivePayment);
  const payment = soonest(payments, now);
  const paid = payment ? payments[payment.index] : null;
  add({
    key: "other:payment",
    label: payment ? `${t("widget.other.payment")} · ${dayWord(payment.at.date)}` : t("widget.other.payment"),
    value: paid ? `${paid.name} · ${money(paid.amount, paid.currency)}` : t("widget.none"),
    color: other,
    tone: null,
  });

  // Limits (monthly, in the main currency): categories over theirs, and what is left in all of them.
  const spentBy = new Map<string, number>();
  for (const tx of entries) {
    if (tx.type === "expense" && tx.date >= monthStart && tx.date <= today) spentBy.set(tx.categoryId, (spentBy.get(tx.categoryId) ?? 0) + value(tx));
  }
  const limited = categories.filter((category) => category.type === "expense" && category.plannedMonthly);
  const limitOf = (category: Category) => category.plannedMonthly ?? 0;
  const over = limited.filter((category) => (spentBy.get(category.id) ?? 0) > limitOf(category));
  const overBy = over.reduce((total, category) => total + (spentBy.get(category.id) ?? 0) - limitOf(category), 0);
  const left = limited.reduce((total, category) => total + Math.max(0, limitOf(category) - (spentBy.get(category.id) ?? 0)), 0);
  add({
    key: "other:limitsOver",
    label: t("widget.other.limitsOver"),
    value: !limited.length ? t("widget.noLimits") : over.length ? `${over.length} · +${money(overBy)}` : t("widget.limitsOk"),
    color: other,
    tone: !limited.length ? null : over.length ? "bad" : "good",
  });
  add({ key: "other:limitsLeft", label: t("widget.other.limitsLeft"), value: limited.length ? money(left) : t("widget.noLimits"), color: other, tone: null });

  // Income minus expenses this month.
  const result = receivedMonth - spentMonth;
  add({ key: "other:result", label: t("widget.other.result"), value: signed(result), color: other, tone: result > 0 ? "good" : result < 0 ? "bad" : null });

  // How much all balances moved this month: every income and expense, balance corrections too (transfers between
  // accounts move nothing overall).
  const moved = transactions.reduce((total, tx) => (tx.date >= monthStart && tx.date <= today ? total + (tx.type === "income" ? 1 : -1) * value(tx) : total), 0);
  add({ key: "other:balanceChange", label: t("widget.other.balanceChange"), value: signed(moved), color: other, tone: moved > 0 ? "good" : moved < 0 ? "bad" : null });

  // The latest entry.
  const last = [...entries].sort((a, b) => (a.date === b.date ? b.clientCreatedAt.localeCompare(a.clientCreatedAt) : b.date.localeCompare(a.date)))[0];
  const lastCategory = last ? categoryById.get(last.categoryId) : undefined;
  const lastAccount = last ? accountById.get(last.accountId) : undefined;
  add({
    key: "other:last",
    label: last ? `${t("widget.other.last")} · ${dayWord(last.date)}` : t("widget.other.last"),
    value: last
      ? `${last.type === "expense" ? "−" : "+"}${money(last.accountAmount, lastAccount?.currency ?? last.currency)}${lastCategory ? ` · ${categoryName(lastCategory, t)}` : ""}`
      : t("widget.none"),
    color: other,
    tone: null,
  });

  // Exchange rates: one line per currency of the user's accounts, against the main currency.
  const rateKeys: string[] = [];
  for (const currency of [...new Set(active.map((account) => account.currency))].filter((code) => code !== base)) {
    const rate = rateBetween(currency, base, rates);
    if (!rate) continue;
    const key = `other:rate:${currency}`;
    rateKeys.push(key);
    add({
      key,
      label: `${t("widget.other.rate")} ${currency}`,
      value: `${formatMoney(100, currency, { ...format, centsInTotals: false })} = ${formatMoney(Math.round(rate * 100), base, { ...format, centsInTotals: true })}`,
      color: other,
      tone: null,
    });
  }

  // Days of this month without a single expense.
  const spentDays = new Set(entries.filter((tx) => tx.type === "expense" && tx.date >= monthStart && tx.date <= today).map((tx) => tx.date));
  add({ key: "other:noSpend", label: t("widget.other.noSpend"), value: `${dayOfMonth - spentDays.size} / ${dayOfMonth}`, color: other, tone: null });

  // The nearest reminder.
  const activeReminders = reminders.filter((item) => item.active !== false);
  const reminder = soonest(activeReminders, now);
  add({
    key: "other:reminder",
    label: reminder ? `${t("widget.other.reminder")} · ${dayWord(reminder.at.date)} ${reminder.at.time}` : t("widget.other.reminder"),
    value: reminder ? activeReminders[reminder.index].title : t("widget.none"),
    color: other,
    tone: null,
  });

  // ---- This month's biggest categories, for the right side of 4×2.
  const topOf = (type: EntryType): WidgetTop[] => {
    const by = new Map<string, number>();
    let total = 0;
    for (const tx of entries) {
      if (tx.type !== type || tx.date < monthStart || tx.date > today) continue;
      const amount = value(tx);
      total += amount;
      by.set(tx.categoryId, (by.get(tx.categoryId) ?? 0) + amount);
    }
    return [...by]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_COUNT)
      .map(([id, amount]) => {
        const category = categoryById.get(id);
        return { name: category ? categoryName(category, t) : "?", color: category?.color ?? "#9e9e9e", amount: money(amount), share: total ? amount / total : 0 };
      });
  };

  const groups: WidgetGroup[] = [
    { key: "totals", title: t("widget.group.totals"), keys: [TOTAL_ALL, TOTAL, TOTAL_EXCLUDED] },
    { key: "accounts", title: t("widget.group.accounts"), keys: active.map((account) => account.id) },
    { key: "expense", title: t("widget.group.expense"), keys: METRICS.map((name) => `exp:${name}`) },
    { key: "income", title: t("widget.group.income"), keys: METRICS.map((name) => `inc:${name}`) },
    {
      key: "other",
      title: t("widget.group.other"),
      keys: ["other:payment", "other:limitsOver", "other:limitsLeft", "other:result", "other:balanceChange", "other:last", ...rateKeys, "other:noSpend", "other:reminder"],
    },
  ];

  const keys = [
    ...LABEL_KEYS,
    ...METRICS.flatMap((name) => [`widget.exp.${name}`, `widget.inc.${name}`]),
    ...OTHER.map((name) => `widget.other.${name}`),
    "widget.none",
    "widget.noLimits",
    "widget.limitsOk",
    ...categories.flatMap((category) => (category.nameKey ? [category.nameKey] : [])),
  ];
  return {
    version: 2,
    updatedAt: now.toISOString(),
    items,
    groups,
    top: { expense: topOf("expense"), income: topOf("income") },
    i18n: Object.fromEntries(keys.map((key) => [key, t(key)])),
  };
};

// A tap opens a new entry (the user's usual type, or the one asked for) over Home: see app/(app)/from-widget.tsx.
export const newEntryUri = (type?: EntryType) => `mybudget://from-widget${type ? `?type=${type}` : ""}`;
