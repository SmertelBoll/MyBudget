import { addDays, todayLocal } from "@/utils/dates";
import { dueOccurrences, nextOccurrence, type Occurrence } from "@/utils/schedule";
import { newId } from "./accounts";
import { getSnapshot, removeEntities, removeEntity, saveEntities, saveEntity } from "./store";
import type { Recurring, Reminder, Transaction } from "./types";

// Spec 8.4. Automatic payments become ordinary entries on their day; missed days (the app wasn't opened) are filled
// in at the next start, up to 60 days back. Each generated entry's id is made from the payment and the occurrence,
// so a second run, or another device doing the same, writes the same record instead of a duplicate.
export const occurrenceEntryId = (recurringId: string, occurrence: Occurrence) =>
  `rp-${recurringId.slice(0, 36)}-${occurrence.date.replace(/-/g, "")}${occurrence.time.replace(":", "")}`;

const entryFor = (payment: Recurring, occurrence: Occurrence): Transaction => ({
  id: occurrenceEntryId(payment.id, occurrence),
  type: payment.type,
  accountId: payment.accountId,
  categoryId: payment.categoryId,
  tagIds: payment.tagIds,
  // Payments are kept in their account's currency (spec 8.3).
  amount: payment.amount,
  currency: payment.currency,
  accountAmount: payment.amount,
  rate: 1,
  date: occurrence.date,
  comment: payment.comment,
  photos: [],
  recurringId: payment.id,
  clientCreatedAt: new Date().toISOString(),
});

// The date up to which everything is done. A later time still ahead today keeps today open.
const doneThrough = (payment: Recurring, handled: Occurrence[]) => {
  const last = handled.at(-1);
  if (!last) return payment.lastGeneratedAt;
  const next = nextOccurrence(payment);
  return next && next.date === last.date ? addDays(last.date, -1) : last.date;
};

let running = false;

// Adds every due occurrence of the automatic payments. Safe to call often (on start, on return to the app, after a
// sync): it only writes what's missing.
export const processDuePayments = async () => {
  if (running) return;
  running = true;
  try {
    const existing = new Set(getSnapshot("transactions").map((tx) => tx.id));
    const entries: Transaction[] = [];
    const updated: Recurring[] = [];
    // A one-time payment has nothing left to do once its entry exists: it goes away.
    const finished: string[] = [];
    for (const payment of getSnapshot("recurring")) {
      if (!payment.autoAdd) continue;
      const due = dueOccurrences(payment, payment.lastGeneratedAt);
      if (!due.length) continue;
      for (const occurrence of due) {
        const entry = entryFor(payment, occurrence);
        if (!existing.has(entry.id)) entries.push(entry);
      }
      if (payment.rule.kind === "once") {
        finished.push(payment.id);
        continue;
      }
      const through = doneThrough(payment, due);
      if (through !== payment.lastGeneratedAt) updated.push({ ...payment, lastGeneratedAt: through });
    }
    if (entries.length) await saveEntities("transactions", entries);
    if (updated.length) await saveEntities("recurring", updated);
    if (finished.length) await removeEntities("recurring", finished);
  } finally {
    running = false;
  }
};

// Payments without auto-add whose day has come: "waiting for confirmation" (spec 8.4), oldest first.
export type PendingPayment = { payment: Recurring; occurrence: Occurrence };
export const pendingPayments = (payments: Recurring[]): PendingPayment[] =>
  payments
    .filter((payment) => !payment.autoAdd)
    .flatMap((payment) => dueOccurrences(payment, payment.lastGeneratedAt).map((occurrence) => ({ payment, occurrence })))
    .sort((a, b) => `${a.occurrence.date} ${a.occurrence.time}`.localeCompare(`${b.occurrence.date} ${b.occurrence.time}`));

// Confirm adds the entry; skip only moves past it. Either way everything up to that occurrence is settled.
export const settlePending = async ({ payment, occurrence }: PendingPayment, confirm: boolean) => {
  if (confirm) await saveEntity("transactions", entryFor(payment, occurrence));
  if (payment.rule.kind === "once") {
    await removeEntity("recurring", payment.id);
    return;
  }
  const handled = dueOccurrences(payment, payment.lastGeneratedAt).filter(
    (o) => `${o.date} ${o.time}` <= `${occurrence.date} ${occurrence.time}`
  );
  await saveEntity("recurring", { ...payment, lastGeneratedAt: doneThrough(payment, handled) });
};

export type RecurringFields = Omit<Recurring, "id" | "createdAt" | "updatedAt" | "lastGeneratedAt">;

// A changed schedule starts counting again from its (new) start, but never re-adds what's already behind today.
export const saveRecurring = async (fields: RecurringFields, existing?: Recurring) => {
  const scheduleChanged =
    existing &&
    (JSON.stringify(existing.rule) !== JSON.stringify(fields.rule) ||
      existing.startDate !== fields.startDate ||
      existing.time !== fields.time ||
      existing.autoAdd !== fields.autoAdd);
  const payment: Recurring = {
    ...existing,
    ...fields,
    id: existing?.id ?? newId(),
    lastGeneratedAt: existing ? (scheduleChanged ? laterOf(existing.lastGeneratedAt, addDays(todayLocal(), -1)) : existing.lastGeneratedAt) : null,
  };
  // A new payment that starts in the past only counts from today on.
  if (!existing && payment.startDate < todayLocal()) payment.lastGeneratedAt = addDays(todayLocal(), -1);
  await saveEntity("recurring", payment);
  await processDuePayments();
  return payment;
};

const laterOf = (a: string | null, b: string) => (!a || b > a ? b : a);

export const deleteRecurring = (id: string) => removeEntity("recurring", id);

export const setRecurringNotify = (payment: Recurring, notify: boolean) => saveEntity("recurring", { ...payment, notify });

// ---- reminders (screen 9) -----------------------------------------------------------------------------------------

export type ReminderFields = Omit<Reminder, "id" | "createdAt" | "updatedAt">;

export const saveReminder = async (fields: ReminderFields, existing?: Reminder) => {
  const reminder: Reminder = { ...existing, ...fields, id: existing?.id ?? newId() };
  await saveEntity("reminders", reminder);
  return reminder;
};

export const deleteReminder = (id: string) => removeEntity("reminders", id);

export const setReminderActive = (reminder: Reminder, active: boolean) => saveEntity("reminders", { ...reminder, active });
