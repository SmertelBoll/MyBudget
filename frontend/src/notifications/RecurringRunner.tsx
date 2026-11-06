import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useCollection } from "@/data/hooks";
import { processDuePayments } from "@/data/recurring";
import { useI18n } from "@/i18n/I18nProvider";
import { formatLongDate, parseLocalDate } from "@/utils/dates";
import { nextOccurrence } from "@/utils/schedule";
import { useMoney } from "@/utils/useMoney";
import { requestNotificationPermission, rescheduleNotifications } from "./notifications";

// Longest sleep before checking again (a payment edited on another device, a clock change).
const MAX_WAIT_MS = 60 * 60 * 1000;

const run = () => processDuePayments().catch((error) => console.warn("payments:", error));

// Runs in the background of the signed-in app (spec 8.4, 9). Adds the automatic payments that are due: on start, on
// every change of the payments (e.g. after a sync), when the app comes back to the front, and exactly when the next
// one is due while the app stays open. Keeps the phone's scheduled notifications in line with payments and reminders.
export function RecurringRunner() {
  const { t, lang } = useI18n();
  const { money } = useMoney();
  const payments = useCollection("recurring");
  const reminders = useCollection("reminders");
  // Bumped once permission is granted, so the notifications are (re)built right away.
  const [allowed, setAllowed] = useState(0);

  useEffect(() => {
    run();
  }, [payments]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") run();
    });
    return () => subscription.remove();
  }, []);

  // Wake up when the next automatic payment is due.
  useEffect(() => {
    let soonest = Infinity;
    for (const payment of payments) {
      if (!payment.autoAdd) continue;
      const next = nextOccurrence(payment);
      if (!next) continue;
      const day = parseLocalDate(next.date);
      const [hours, minutes] = next.time.split(":").map(Number);
      soonest = Math.min(soonest, new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).getTime());
    }
    if (soonest === Infinity) return;
    const timer = setTimeout(run, Math.min(Math.max(soonest - Date.now() + 1000, 1000), MAX_WAIT_MS));
    return () => clearTimeout(timer);
  }, [payments]);

  // Something wants notifications: ask the system once (it remembers the answer).
  const wantsNotifications = payments.some((payment) => payment.notify) || reminders.some((reminder) => reminder.active);
  useEffect(() => {
    if (!wantsNotifications) return;
    requestNotificationPermission().then((granted) => {
      if (granted) setAllowed((value) => value + 1);
    });
  }, [wantsNotifications]);

  useEffect(() => {
    rescheduleNotifications(payments, reminders, {
      payment: (payment) => ({
        title: payment.name,
        body: t(payment.autoAdd ? "recurring.notifyAdded" : "recurring.notifyConfirm", {
          amount: `${payment.type === "expense" ? "−" : "+"}${money(payment.amount, payment.currency)}`,
        }),
      }),
      reminder: (reminder) => ({ title: reminder.title, body: reminder.comment || formatLongDate(reminder.startDate, lang) }),
    });
  }, [payments, reminders, t, money, lang, allowed]);

  return null;
}
