import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  api,
  clearTokens,
  getRefreshToken,
  refreshSession,
  saveTokens,
  setSessionEndedHandler,
} from "@/api/client";
import type { AuthPayload, User, UserPatch } from "@/api/types";
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
  deleteAccount: () => Promise<void>;
};

const USER_KEY = "auth.user";

const AuthContext = createContext<AuthContextValue | null>(null);

const mergePatch = (user: User, patch: UserPatch): User => ({
  ...user,
  ...patch,
  settings: { ...user.settings, ...patch.settings },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);

  const applyUser = useCallback((next: User) => {
    setUser(next);
    writeJson(USER_KEY, next);
  }, []);

  const forgetUser = useCallback(async () => {
    setUser(null);
    setStatus("signedOut");
    await Promise.all([clearTokens(), storage.remove(USER_KEY)]);
  }, []);

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
      const [refreshToken, cached] = await Promise.all([getRefreshToken(), readJson<User>(USER_KEY)]);
      if (!refreshToken) {
        setStatus("signedOut");
        return;
      }
      if (cached) {
        setUser(cached);
        setStatus("signedIn");
        refreshSession()
          .then((payload) => applyUser(payload.user))
          .catch(() => {});
        return;
      }
      try {
        const payload = await refreshSession();
        applyUser(payload.user);
        setStatus("signedIn");
      } catch {
        setStatus("signedOut");
      }
    })();

    return () => setSessionEndedHandler(null);
  }, [applyUser]);

  const authenticate = useCallback(
    async (path: string, email: string, password: string) => {
      const payload = await api.post<AuthPayload>(
        path,
        { email, password, device: await getDeviceInfo() },
        { auth: false }
      );
      await saveTokens(payload);
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

  // Applied locally at once; the server copy wins when it answers.
  // TODO(sync phase): queue the patch when offline instead of dropping it.
  const updateMe = useCallback(
    async (patch: UserPatch) => {
      setUser((current) => (current ? mergePatch(current, patch) : current));
      const { user: saved } = await api.patch<{ user: User }>("/me", patch);
      applyUser(saved);
    },
    [applyUser]
  );

  const deleteAccount = useCallback(async () => {
    await api.del("/me");
    setEndedReason(null);
    await forgetUser();
  }, [forgetUser]);

  const value = useMemo(
    () => ({ status, user, endedReason, signIn, signUp, signOut, updateMe, deleteAccount }),
    [status, user, endedReason, signIn, signUp, signOut, updateMe, deleteAccount]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
};
