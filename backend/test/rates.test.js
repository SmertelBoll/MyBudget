import { startServer, stopServer } from "./helpers.js";
import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { refreshRates } from "../jobs/rates.js";

before(startServer);
after(stopServer);
afterEach(() => mock.restoreAll());

const respond = (byUrl) =>
  mock.method(globalThis, "fetch", async (url) => {
    const body = byUrl(String(url));
    if (!body) return new Response("down", { status: 503 });
    return new Response(JSON.stringify(body), { status: 200 });
  });

describe("exchange rates", () => {
  it("uses the main source, then keeps currencies the fallback lacks", async () => {
    respond((url) => url.includes("er-api") && { result: "success", rates: { USD: 1, EUR: 0.9, UAH: 41 } });
    const first = await refreshRates();
    assert.equal(first.rates.UAH, 41);

    // Main source down; Frankfurter has EUR but no UAH.
    respond((url) => url.includes("frankfurter") && { base: "USD", rates: { EUR: 0.95 } });
    const second = await refreshRates();
    assert.equal(second.rates.EUR, 0.95);
    assert.equal(second.rates.UAH, 41);
  });

  it("ignores a broken response", async () => {
    respond(() => ({ result: "success", rates: { USD: 1, EUR: -3 } }));
    assert.equal(await refreshRates(), null);
  });
});
