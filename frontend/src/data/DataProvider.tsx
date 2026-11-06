import { useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { User } from "@/api/types";
import { loadRates } from "./rates";
import { countOutbox, getMeta, loadAll, setMeta, wipeLocal } from "./store";
import { requestSync, startSync, stopSync } from "./sync";
import { loadLastUsedDate } from "./transactions";

const SYNC_EVERY_MS = 60 * 1000;

// The device keeps one user's data. Another account signing in starts from an empty database; the same account
// signing in again finds its records (and any unsent changes, spec 3.3) where it left them.
const bindUser = async (user: User) => {
  const owner = await getMeta("userId");
  if (owner !== user.id) {
    await wipeLocal();
    await setMeta({ userId: user.id, email: user.email, epoch: String(user.dataEpoch), cursor: "0" });
  }
};

// For the sign-in screen (spec 3.3): unsent changes of a different account that signing in would erase.
export const pendingChangesOfOtherAccount = async (email: string) => {
  const owner = await getMeta("email");
  if (!owner || owner.toLowerCase() === email.trim().toLowerCase()) return 0;
  return countOutbox();
};

export function DataProvider({ user, children }: { user: User; children: ReactNode }) {
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bindUser(user);
      await loadAll();
      await loadLastUsedDate();
      await startSync();
      loadRates();
      if (cancelled) return;
      setReadyFor(user.id);
      requestSync();
    })();

    const foreground = AppState.addEventListener("change", (next) => {
      if (next === "active") requestSync();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") requestSync();
    }, SYNC_EVERY_MS);

    return () => {
      cancelled = true;
      foreground.remove();
      clearInterval(timer);
      stopSync();
    };
    // Only a different account rebinds; profile edits of the same user don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  if (readyFor !== user.id) return null;
  return children;
}
