import { AppState } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { getRefreshToken } from "@/api/client";
import type { User } from "@/api/types";
import { getRates, loadRates } from "@/data/rates";
import { getMeta, getSnapshot, loadAll } from "@/data/store";
import { requestSync, startSync } from "@/data/sync";
import { readJson } from "@/storage/json";
import { todayLocal } from "@/utils/dates";
import { refreshWidgets } from "./refresh";
import { buildSnapshot, readSnapshot } from "./snapshot";

// About once an hour, with the app closed: send unsent changes, take other devices' ones, refresh the rates, then
// redraw the widgets. Android's WorkManager runs it only with a network and enough battery, and holds it while the
// phone sits unused (Doze): overnight it mostly waits, and runs soon after the phone is picked up again.
export const BACKGROUND_SYNC = "mybudget-background-sync";
const EVERY_MINUTES = 60;
const USER_KEY = "auth.user";

const backgroundRefresh = async () => {
  // With the app open, its own sync and widget updates already run.
  if (AppState.currentState === "active") return;
  const user = await readJson<User>(USER_KEY);
  if (!user || !(await getRefreshToken())) return;
  // The local data must be this user's (it is, unless someone else signed in and out since).
  if ((await getMeta("userId")) !== user.id) return;

  await loadAll();
  await startSync();
  await Promise.all([requestSync(), loadRates()]);

  // No dictionary here: the last snapshot carries the words it needs.
  const previous = await readSnapshot();
  const snapshot = buildSnapshot({
    user,
    lang: user.language,
    t: (key) => previous?.i18n[key] ?? key,
    accounts: getSnapshot("accounts"),
    categories: getSnapshot("categories"),
    transactions: getSnapshot("transactions"),
    transfers: getSnapshot("transfers"),
    rates: getRates(),
    today: todayLocal(),
  });
  await refreshWidgets(snapshot);
};

// Must run at start-up, outside any screen (index.js), so Android can find the task when the app isn't open.
TaskManager.defineTask(BACKGROUND_SYNC, async () => {
  try {
    await backgroundRefresh();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn("background sync failed:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Called once the user is signed in; registering again is harmless.
export const registerBackgroundSync = async () => {
  if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
  await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC, { minimumInterval: EVERY_MINUTES });
};
