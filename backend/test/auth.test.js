import { PASSWORD, api, device, login, register, startServer, stopServer } from "./helpers.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

let app;
let http;

before(async () => {
  app = await startServer();
  http = api(app);
});
after(stopServer);

describe("registration", () => {
  it("creates the user, default categories and a session", async () => {
    const body = await register(app, "Anna@Gmail.com");
    assert.equal(body.user.email, "anna@gmail.com");
    assert.equal(body.user.passwordHash, undefined);
    assert.ok(body.accessToken && body.refreshToken);

    const categories = await http.get("/categories", body.accessToken);
    assert.equal(categories.status, 200);
    assert.equal(categories.body.items.length, 14);
    assert.equal(categories.body.items.filter((c) => c.isSystemOther).length, 2);
  });

  it("rejects other domains, weak passwords and duplicates", async () => {
    const outlook = await http.post("/auth/register", { email: "a@outlook.com", password: PASSWORD });
    assert.equal(outlook.body.code, "auth.emailDomainNotAllowed");

    const short = await http.post("/auth/register", { email: "b@gmail.com", password: "1234567" });
    assert.equal(short.body.code, "auth.passwordTooShort");

    const common = await http.post("/auth/register", { email: "b@gmail.com", password: "Password123" });
    assert.equal(common.body.code, "auth.passwordTooCommon");

    const duplicate = await http.post("/auth/register", { email: "anna@gmail.com", password: PASSWORD });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, "auth.emailTaken");
  });

  it("rejects operator keys in the body", async () => {
    const res = await http.post("/auth/login", { email: { $ne: null }, password: PASSWORD });
    assert.equal(res.status, 400);
  });
});

describe("login", () => {
  it("gives the same answer for an unknown email and a wrong password", async () => {
    const unknown = await http.post("/auth/login", { email: "nobody@gmail.com", password: PASSWORD });
    const wrong = await http.post("/auth/login", { email: "anna@gmail.com", password: "wrong-password" });
    assert.equal(unknown.status, 401);
    assert.deepEqual(unknown.body, wrong.body);
  });

  it("locks the account after 5 failures", async () => {
    await register(app, "locked@gmail.com");
    for (let i = 0; i < 5; i += 1) {
      await http.post("/auth/login", { email: "locked@gmail.com", password: "wrong-password" });
    }
    const res = await http.post("/auth/login", { email: "locked@gmail.com", password: PASSWORD });
    assert.equal(res.status, 429);
    assert.equal(res.body.code, "auth.tooManyAttempts");
  });

  it("needs a token for /me", async () => {
    const res = await http.get("/me");
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "auth.required");
  });
});

describe("refresh tokens", () => {
  it("rotate, and reusing an old one ends the session", async () => {
    const first = await login(app, "anna@gmail.com", "Phone");

    const second = await http.post("/auth/refresh", { refreshToken: first.refreshToken });
    assert.equal(second.status, 200);
    assert.notEqual(second.body.refreshToken, first.refreshToken);

    const third = await http.post("/auth/refresh", { refreshToken: second.body.refreshToken });
    assert.equal(third.status, 200);

    // The retired token comes back: treated as stolen.
    const reuse = await http.post("/auth/refresh", { refreshToken: second.body.refreshToken });
    assert.equal(reuse.status, 401);
    assert.equal(reuse.body.code, "session.revoked");

    // ...and the latest token of that session no longer works either.
    const after = await http.post("/auth/refresh", { refreshToken: third.body.refreshToken });
    assert.equal(after.body.code, "session.revoked");
  });

  it("logout revokes the session", async () => {
    const session = await login(app, "anna@gmail.com", "Tablet");
    const res = await http.post("/auth/logout", { refreshToken: session.refreshToken });
    assert.equal(res.status, 204);
    const refresh = await http.post("/auth/refresh", { refreshToken: session.refreshToken });
    assert.equal(refresh.body.code, "session.revoked");
  });
});

describe("sessions", () => {
  it("lists devices and ends the others", async () => {
    await register(app, "multi@gmail.com", "iPhone 15");
    const laptop = await login(app, "multi@gmail.com", "Pixel 8");
    const phone = await login(app, "multi@gmail.com", "Galaxy S24");

    const list = await http.get("/sessions", phone.accessToken);
    assert.equal(list.body.sessions.length, 3);
    const current = list.body.sessions.filter((s) => s.isCurrent);
    assert.deepEqual(current.map((s) => s.deviceName), ["Galaxy S24"]);

    const self = await http.del(`/sessions/${phone.sessionId}`, phone.accessToken);
    assert.equal(self.body.code, "session.cannotRevokeCurrent");

    const one = await http.del(`/sessions/${laptop.sessionId}`, phone.accessToken);
    assert.equal(one.status, 204);
    const revoked = await http.post("/auth/refresh", { refreshToken: laptop.refreshToken });
    assert.equal(revoked.body.code, "session.revoked");

    const others = await http.del("/sessions/others", phone.accessToken);
    assert.equal(others.body.revoked, 1);
    const remaining = await http.get("/sessions", phone.accessToken);
    assert.equal(remaining.body.sessions.length, 1);
  });

  it("can't end another user's session", async () => {
    const anna = await login(app, "anna@gmail.com", "Phone");
    const other = await login(app, "multi@gmail.com", "Galaxy S24");
    const res = await http.del(`/sessions/${anna.sessionId}`, other.accessToken);
    assert.equal(res.status, 404);
  });
});

describe("rename a session", () => {
  it("renames own sessions only", async () => {
    const mine = await login(app, "multi@gmail.com", "Galaxy S24");
    const res = await http.patch("/sessions/" + mine.sessionId, { name: "  Work phone " }, mine.accessToken);
    assert.equal(res.status, 204);
    const list = await http.get("/sessions", mine.accessToken);
    assert.equal(list.body.sessions.find((s) => s.isCurrent).deviceName, "Work phone");

    const anna = await login(app, "anna@gmail.com", "Phone");
    const foreign = await http.patch("/sessions/" + anna.sessionId, { name: "Mine now" }, mine.accessToken);
    assert.equal(foreign.status, 404);
    const empty = await http.patch("/sessions/" + mine.sessionId, { name: " " }, mine.accessToken);
    assert.equal(empty.status, 400);

    await http.patch("/sessions/" + mine.sessionId, { name: null }, mine.accessToken);
    const reset = await http.get("/sessions", mine.accessToken);
    const current = reset.body.sessions.find((s) => s.isCurrent);
    assert.equal(current.deviceName, "Galaxy S24");
    assert.equal(current.renamed, false);
  });
});

describe("profile", () => {
  it("updates fields and merges settings", async () => {
    const { accessToken } = await login(app, "anna@gmail.com");
    const res = await http.patch(
      "/me",
      { name: "Anna", baseCurrency: "UAH", onboarded: true, settings: { focus: "income" } },
      accessToken
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.user.baseCurrency, "UAH");
    assert.equal(res.body.user.settings.focus, "income");
    assert.equal(res.body.user.settings.defaultPeriod, "week");

    const bad = await http.patch("/me", { language: "xx" }, accessToken);
    assert.equal(bad.status, 400);
  });

  it("deleting the account removes the user and their sessions", async () => {
    const { accessToken, refreshToken } = await register(app, "gone@gmail.com");
    const res = await http.del("/me", accessToken);
    assert.equal(res.status, 204);

    const relogin = await http.post("/auth/login", { email: "gone@gmail.com", password: PASSWORD, device: device() });
    assert.equal(relogin.body.code, "auth.invalidCredentials");
    const refresh = await http.post("/auth/refresh", { refreshToken });
    assert.equal(refresh.body.code, "session.invalid");
  });
});
