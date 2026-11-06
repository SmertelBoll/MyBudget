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

// Android 13+ only shows the permission prompt once the app has a notification channel, so it's created first.
// Every field is given a value: some native builds (Expo Go) fail while sending the new channel back to JS when one
// of them is empty, after the channel already exists. Such a failure is therefore not a reason to stop.
let channelReady = false;
const ensureChannel = async () => {
  if (Platform.OS !== "android" || channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Payments and reminders",
      description: "Regular payments and reminders",
      importance: AndroidImportance.HIGH,
      groupId: "mybudget",
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
    });
  } catch (error) {
    console.warn("notification channel:", error instanceof Error ? error.message : error);
  }
  channelReady = true;
};

export const notificationsAllowed = async () => {
  if (!supported) return false;
  return (await Notifications.getPermissionsAsync()).granted;
};

// Asks once when the user turns a notification on. False: the system said no (the screen then suggests the phone's
// settings, spec 4.5).
export const requestNotificationPermission = async () => {
  if (!supported) return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
};

// Calls `open` with the screen of a notification the user tapped: now, and the one that launched the app if it was
// closed. Returns the unsubscribe function.
export const onNotificationOpened = (open: (url: string) => void) => {
  if (!supported) return () => {};
  const urlOf = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    return typeof url === "string" ? url : null;
  };
  const launched = urlOf(Notifications.getLastNotificationResponse());
  if (launched) {
    open(launched);
    Notifications.clearLastNotificationResponse();
  }
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = urlOf(response);
    if (url) open(url);
  });
  return () => subscription.remove();
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
  await ensureChannel();
  const from = todayLocal();
  const to = addDays(from, WINDOW_DAYS);
  const now = Date.now();
  const at = (date: string, time: string) => {
    const day = parseLocalDate(date);
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).getTime();
  };

  // Each notification has a stable id (what + when), so a rebuild replaces it instead of adding a second one.
  // url: the screen a tap on the notification opens (payments waiting for confirmation -> the payments list).
  const planned: { id: string; when: number; url?: string; content: { title: string; body: string } }[] = [];
  for (const payment of payments) {
    if (!payment.notify || payment.active === false) continue;
    for (const occurrence of occurrencesBetween(payment, from, to, 40)) {
      planned.push({
        id: `p:${payment.id}:${occurrence.date}T${occurrence.time}`,
        when: at(occurrence.date, occurrence.time),
        url: payment.autoAdd ? undefined : "/recurring",
        content: texts.payment(payment),
      });
    }
  }
  for (const reminder of reminders) {
    if (!reminder.active) continue;
    for (const occurrence of occurrencesBetween(reminder, from, to, 40)) {
      planned.push({ id: `r:${reminder.id}:${occurrence.date}T${occurrence.time}`, when: at(occurrence.date, occurrence.time), content: texts.reminder(reminder) });
    }
  }
  const upcoming = planned.filter((item) => item.when > now).sort((a, b) => a.when - b.when).slice(0, MAX_SCHEDULED);
  const keep = new Set(upcoming.map((item) => item.id));

  // Only future notifications that are no longer wanted are removed. One whose time has come stays: Android may
  // deliver it a little late, and removing it then (e.g. because the payment it announces was just added and the
  // plan rebuilt) would lose it.
  for (const request of await Notifications.getAllScheduledNotificationsAsync()) {
    // Ones from before stable ids carry no time: they are replaced by the plan.
    const when = request.content.data?.when;
    const stale = when === undefined || Number(when) > now;
    if (!keep.has(request.identifier) && stale) await Notifications.cancelScheduledNotificationAsync(request.identifier);
  }
  for (const item of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: { ...item.content, data: { when: item.when, ...(item.url && { url: item.url }) } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.when, channelId: CHANNEL },
    });
  }
};
