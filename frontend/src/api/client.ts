import { secureStorage } from "@/storage/storage";
import type { AuthPayload } from "./types";

const ORIGIN = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:4444").replace(/\/$/, "");
const BASE_URL = `${ORIGIN}/api/v1`;
const TIMEOUT_MS = 20000;
const REFRESH_TIMEOUT_MS = 90_000;
const REFRESH_TOKEN_KEY = "auth.refreshToken";

// The server answers with { code } only; the UI shows t(code). status 0 = no connection.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown
  ) {
    super(code);
  }
}

// A free Render instance sleeps when idle and takes up to a minute to wake: one knock at launch, so it is up by the
// time the user signs in or syncs. The answer doesn't matter.
export const wakeServer = () => {
  fetch(`${ORIGIN}/health`).catch(() => {});
};

// After a request timed out: wait (up to a minute, shared by all callers) until the server answers its health check.
// True means it is up now, so the timeout was the server waking, not a missing connection.
const WAKE_WAIT_MS = 60_000;
let waking: Promise<boolean> | null = null;
const serverAwake = () => {
  waking ??= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WAKE_WAIT_MS);
    try {
      return (await fetch(`${ORIGIN}/health`, { signal: controller.signal })).ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    waking = null;
  });
  return waking;
};

// Status 0: no answer at all. "common.noInternet" when the server couldn't be reached, "common.timeout" when it was
// reachable but didn't answer in time.
export const isNetworkError = (error: unknown) => error instanceof ApiError && error.status === 0;
export const isOffline = (error: unknown) => isNetworkError(error) && (error as ApiError).code === "common.noInternet";

// The access token lives in memory only; the refresh token in the secure store (spec 3.2).
let accessToken: string | null = null;
let refreshInFlight: Promise<AuthPayload> | null = null;
let onSessionEnded: ((code: string) => void) | null = null;

// Codes that mean the session is gone for good (revoked on another device, expired, unknown). Anything else, e.g. no
// connection, keeps the user signed in: the app works offline with an expired access token.
const SESSION_GONE = new Set(["session.invalid", "session.revoked", "session.expired"]);

export const setSessionEndedHandler = (handler: ((code: string) => void) | null) => {
  onSessionEnded = handler;
};

export const getRefreshToken = () => secureStorage.get(REFRESH_TOKEN_KEY);

export const saveTokens = async (payload: Pick<AuthPayload, "accessToken" | "refreshToken">) => {
  accessToken = payload.accessToken;
  await secureStorage.set(REFRESH_TOKEN_KEY, payload.refreshToken);
};

export const clearTokens = async () => {
  accessToken = null;
  await secureStorage.remove(REFRESH_TOKEN_KEY);
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type SendOptions = { token?: string | null; timeoutMs?: number; retry?: boolean };

const send = async <T,>(method: Method, path: string, body: unknown, { token, timeoutMs = TIMEOUT_MS, retry }: SendOptions = {}): Promise<T> => {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  // Photos go up as multipart: fetch sets that Content-Type (with the boundary) itself.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !isForm && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (__DEV__) console.warn(`${method} ${path} failed before a response:`, error);
    clearTimeout(timer);
    if (!timedOut) throw new ApiError(0, "common.noInternet");
    // A sleeping free server takes up to a minute to wake, longer than one request waits. Once it answers, a
    // request that is safe to repeat goes again; any other reports the timeout, not a missing connection.
    if (!(await serverAwake())) throw new ApiError(0, "common.noInternet");
    if (retry) return send<T>(method, path, body, { token, timeoutMs, retry: false });
    throw new ApiError(0, "common.timeout");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code || "common.serverError", data.details);
  return data as T;
};

// Rotation means a refresh token works once: parallel refreshes would look like token theft to the server and end
// the session, so every caller shares one in-flight refresh.
export const refreshSession = (): Promise<AuthPayload> => {
  refreshInFlight ??= (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw new ApiError(401, "session.invalid");
    try {
      // Never repeated, and waits out a waking server: a refresh the server carried out but whose answer the app gave
      // up on would leave the app with the retired token, and presenting that one ends the session.
      const payload = await send<AuthPayload>("POST", "/auth/refresh", { refreshToken }, { timeoutMs: REFRESH_TIMEOUT_MS });
      await saveTokens(payload);
      return payload;
    } catch (error) {
      if (error instanceof ApiError && SESSION_GONE.has(error.code)) {
        await clearTokens();
        onSessionEnded?.(error.code);
      }
      throw error;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

// timeoutMs: longer for a request the server works on for a while (restoring a backup), so the app doesn't give up
// on it and report "no connection" while the server is still finishing.
// retry: the request is safe to send twice (reads always are), so after a timeout on a waking server it goes again.
type RequestOptions = { body?: unknown; auth?: boolean; timeoutMs?: number; retry?: boolean };

export const request = async <T,>(method: Method, path: string, { body, auth = true, timeoutMs, retry = method === "GET" }: RequestOptions = {}) => {
  if (!auth) return send<T>(method, path, body, { timeoutMs, retry });

  if (!accessToken) await refreshSession();
  try {
    return await send<T>(method, path, body, { token: accessToken, timeoutMs, retry });
  } catch (error) {
    const expired = error instanceof ApiError && (error.code === "auth.tokenExpired" || error.code === "auth.invalidToken");
    if (!expired) throw error;
    await refreshSession();
    return send<T>(method, path, body, { token: accessToken, timeoutMs, retry });
  }
};

export const api = {
  get: <T,>(path: string, options?: Omit<RequestOptions, "body">) => request<T>("GET", path, options),
  post: <T,>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...options, body }),
  put: <T,>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  del: <T,>(path: string) => request<T>("DELETE", path),
};
