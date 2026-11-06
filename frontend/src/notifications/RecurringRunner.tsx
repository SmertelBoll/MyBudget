import { useEffect } from "react";
import { AppState } from "react-native";
import { useCollection } from "@/data/hooks";
import { processDuePayments } from "@/data/recurring";
import { useI18n } from "@/i18n/I18nProvider";
import { formatLongDate } from "@/utils/dates";
import { useMoney } from "@/utils/useMoney";
import { rescheduleNotifications } from "./notifications";

// Runs in the background of the signed-in app (spec 8.4, 9): adds the automatic payments that are due (on start, on
// every change of the payments, e.g. after a sync, and whenever the app comes back to the front) and keeps the
// phone's scheduled notifications in line with payments and reminders.
export function RecurringRunner() {
  const { t, lang } = useI18n();
  const { money } = useMoney();
  const payments = useCollection("recurring");
  const reminders = useCollection("reminders");

  useEffect(() => {
    processDuePayments().catch((error) => console.warn("payments:", error));
  }, [payments]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") processDuePayments().catch((error) => console.warn("payments:", error));
    });
    return () => subscription.remove();
  }, []);

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
  }, [payments, reminders, t, money, lang]);

  return null;
}
