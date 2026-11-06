import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useNavigation } from "expo-router";

const TICK_MS = 30_000;

// The current time for lists that depend on it (what's due, the next date). Drawer screens stay mounted, so without
// this a list computed earlier would never show a payment whose time has come. Updates every 30 s, when the screen
// is opened again and when the app comes back to the front.
export const useClock = () => {
  const [now, setNow] = useState(() => Date.now());
  const navigation = useNavigation();

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, TICK_MS);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    const focus = navigation.addListener("focus", tick);
    return () => {
      clearInterval(timer);
      appState.remove();
      focus();
    };
  }, [navigation]);

  return now;
};
