import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import type { Recurring, Reminder } from "@/data/types";
import { addDays, parseLocalDate, todayLocal } from "@/utils/dates";
import { occurrencesBetween } from "@/utils/schedule";

// Spec 8.4, 9: local notifications (they work offline). Everything ahead is scheduled on the device: the next 30 days
// of payments with notifications on and active reminders, at most 60 in all (iOS keeps only 64 per app). They are
// rebuilt whenever payments or reminders change and every time the app opens, so the window keeps moving.

const CHANNEL = "payments";
const WINDOW_DAYS = 30;
const MAX_SCHEDULED = 60;
const supported = Platform.OS !== "web";

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export const notificationsAllowed = async () => {
  if (!supported) return false;
  return (await Notifications.getPermissionsAsync()).granted;
};

// Asks once when the user turns a notification on. False: the system said no (the screen then suggests the phone's
// settings, spec 4.5).
export const requestNotificationPermission = async () => {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
};

export type NotificationTexts = {
  payment: (payment: Recurring) => { title: string; body: string };
  reminder: (reminder: Reminder) => { title: string; body: string };
};

let pending: ReturnType<typeof setTimeout> | null = null;

// Debounced: a burst of changes (a sync, a save) leads to one rebuild.
export const rescheduleNotifications = (payments: Recurring[], reminders: Reminder[], texts: NotificationTexts) => {
  if (!supported) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    rebuild(payments, reminders, texts).catch((error) => console.warn("notifications:", error));
  }, 800);
};

const rebuild = async (payments: Recurring[], reminders: Reminder[], texts: NotificationTexts) => {
  if (!(await notificationsAllowed())) return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Payments and reminders", importance: AndroidImportance.HIGH });
  }
  const from = todayLocal();
  const to = addDays(from, WINDOW_DAYS);
  const now = Date.now();
  const at = (date: string, time: string) => {
    const day = parseLocalDate(date);
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).getTime();
  };

  const planned: { when: number; content: { title: string; body: string } }[] = [];
  for (const payment of payments) {
    if (!payment.notify) continue;
    for (const occurrence of occurrencesBetween(payment, from, to, 40)) {
      planned.push({ when: at(occurrence.date, occurrence.time), content: texts.payment(payment) });
    }
  }
  for (const reminder of reminders) {
    if (!reminder.active) continue;
    for (const occurrence of occurrencesBetween(reminder, from, to, 40)) {
      planned.push({ when: at(occurrence.date, occurrence.time), content: texts.reminder(reminder) });
    }
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  const upcoming = planned.filter((item) => item.when > now).sort((a, b) => a.when - b.when).slice(0, MAX_SCHEDULED);
  for (const item of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: item.content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.when, channelId: CHANNEL },
    });
  }
};
