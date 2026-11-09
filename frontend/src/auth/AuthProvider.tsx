import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  api,
  clearTokens,
  isNetworkError,
  getRefreshToken,
  refreshSession,
  saveTokens,
  setSessionEndedHandler,
} from "@/api/client";
import type { AuthPayload, User, UserPatch } from "@/api/types";
import { wipeLocal } from "@/data/store";
import { subscribeSync, getSyncState } from "@/data/sync";
import { readJson, writeJson } from "@/storage/json";
import { storage } from "@/storage/storage";
import { getDeviceInfo } from "./device";

type Status = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: Status;
  user: User | null;
  // Why the last session ended without the user logging out (e.g. "session.revoked"); shown on the sign-in screen.
  endedReason: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateMe: (patch: UserPatch) => Promise<void>;
  // A user the server returned from another call (restore, delete all data).
  acceptUser: (user: User) => void;
  deleteAccount: () => Promise<void>;
};

const USER_KEY = "auth.user";
// Profile and settings changes made offline, merged into one patch and sent when the server is reachable again.
const PENDING_KEY = "auth.pendingPatch";

const AuthContext = createContext<AuthContextValue | null>(null);

const mergePatch = <T extends UserPatch>(user: T, patch: UserPatch): T => ({
  ...user,
  ...patch,
  settings: { ...user.settings, ...patch.settings },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const pending = useRef<UserPatch | null>(null);
  const flushing = useRef<Promise<void> | null>(null);

  const applyUser = useCallback((next: User) => {
    setUser(next);
    writeJson(USER_KEY, next);
  }, []);

  const forgetUser = useCallback(async () => {
    setUser(null);
    setStatus("signedOut");
    pending.current = null;
    await Promise.all([clearTokens(), storage.remove(USER_KEY), storage.remove(PENDING_KEY)]);
  }, []);

  // A user from the server with the changes it hasn't received yet on top.
  const fromServer = useCallback((next: User) => applyUser(pending.current ? mergePatch(next, pending.current) : next), [applyUser]);

  // Sends the queued patch. Offline it stays queued; a patch the server refuses is dropped (the server copy wins).
  const flush = useCallback((): Promise<void> => {
    if (flushing.current) return flushing.current;
    const run = async () => {
      while (pending.current) {
        const patch = pending.current;
        try {
          const { user: saved } = await api.patch<{ user: User }>("/me", patch);
          if (pending.current === patch) {
            pending.current = null;
            await storage.remove(PENDING_KEY);
          }
          fromServer(saved);
        } catch (error) {
          if (isNetworkError(error)) return;
          if (pending.current === patch) {
            pending.current = null;
            await storage.remove(PENDING_KEY);
          }
          api.get<{ user: User }>("/me").then(({ user: saved }) => fromServer(saved)).catch(() => {});
          throw error;
        }
      }
    };
    flushing.current = run().finally(() => {
      flushing.current = null;
    });
    return flushing.current;
  }, [fromServer]);

  // Retried whenever a sync gets through (the connection is back).
  useEffect(() => {
    let last = getSyncState().status;
    const unsubscribe = subscribeSync(() => {
      const status = getSyncState().status;
      if (status === "idle" && last !== "idle" && pending.current) flush().catch(() => {});
      last = status;
    });
    return () => {
      unsubscribe();
    };
  }, [flush]);

  // Offline-first start (spec 3.2, 4): with a stored refresh token and cached user the app opens at once; the
  // session is refreshed in the background, and only a definite "session gone" answer signs the user out.
  useEffect(() => {
    setSessionEndedHandler((code) => {
      setEndedReason(code);
      setUser(null);
      setStatus("signedOut");
      storage.remove(USER_KEY);
    });

    (async () => {
      const [refreshToken, cached, queued] = await Promise.all([
        getRefreshToken(),
        readJson<User>(USER_KEY),
        readJson<UserPatch>(PENDING_KEY),
      ]);
      pending.current = queued;
      if (!refreshToken) {
        setStatus("signedOut");
        return;
      }
      if (cached) {
        setUser(cached);
        setStatus("signedIn");
        refreshSession()
          .then((payload) => {
            fromServer(payload.user);
            return flush();
          })
          .catch(() => {});
        return;
      }
      try {
        const payload = await refreshSession();
        fromServer(payload.user);
        setStatus("signedIn");
      } catch {
        setStatus("signedOut");
      }
    })();

    return () => setSessionEndedHandler(null);
  }, [applyUser, fromServer, flush]);

  const authenticate = useCallback(
    async (path: string, email: string, password: string) => {
      const payload = await api.post<AuthPayload>(
        path,
        { email, password, device: await getDeviceInfo() },
        { auth: false }
      );
      await saveTokens(payload);
      pending.current = null;
      await storage.remove(PENDING_KEY);
      applyUser(payload.user);
      setEndedReason(null);
      setStatus("signedIn");
    },
    [applyUser]
  );

  const signIn = useCallback((email: string, password: string) => authenticate("/auth/login", email, password), [authenticate]);
  const signUp = useCallback((email: string, password: string) => authenticate("/auth/register", email, password), [authenticate]);

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    // Best effort: offline the session simply stays on the server until it expires or is ended from another device.
    if (refreshToken) api.post("/auth/logout", { refreshToken }, { auth: false }).catch(() => {});
    setEndedReason(null);
    await forgetUser();
  }, [forgetUser]);

  // Applied and stored locally at once, so it works offline too; the patch goes to the server now or once the
  // connection is back. Only a refusal from the server (not a missing connection) rejects.
  const updateMe = useCallback(
    async (patch: UserPatch) => {
      setUser((current) => {
        if (!current) return current;
        const next = mergePatch(current, patch);
        writeJson(USER_KEY, next);
        return next;
      });
      pending.current = mergePatch(pending.current ?? {}, patch);
      await writeJson(PENDING_KEY, pending.current);
      await flush();
    },
    [flush]
  );

  const deleteAccount = useCallback(async () => {
    await api.del("/me");
    await wipeLocal();
    setEndedReason(null);
    await forgetUser();
  }, [forgetUser]);

  const value = useMemo(
    () => ({ status, user, endedReason, signIn, signUp, signOut, updateMe, acceptUser: fromServer, deleteAccount }),
    [status, user, endedReason, signIn, signUp, signOut, updateMe, fromServer, deleteAccount]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
};
