import { config } from "../config.js";
import { ExchangeRateModel } from "../models/misc.js";

const BASE = "USD";
const HOUR_MS = 60 * 60 * 1000;
const STALE_AFTER_MS = 23 * HOUR_MS;

const fetchJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
};

// Both return USD-based rates; open.er-api (160+ currencies, no key) first, Frankfurter (ECB) as the fallback.
const SOURCES = [
  { url: () => config.rates.url, parse: (json) => (json.result === "success" ? json.rates : null) },
  { url: () => config.rates.fallbackUrl, parse: (json) => (json.rates ? { ...json.rates, [json.base]: 1 } : null) },
];

const isValidRates = (rates) =>
  rates && rates[BASE] === 1 && Object.values(rates).every((value) => Number.isFinite(value) && value > 0);

export const getLatestRates = () => ExchangeRateModel.findOne({ base: BASE }).lean();

export const refreshRates = async () => {
  for (const source of SOURCES) {
    const url = source.url();
    try {
      const rates = source.parse(await fetchJson(url));
      if (!isValidRates(rates)) throw new Error(`unexpected response from ${url}`);
      // Laid over the previous rates: the ECB fallback has ~30 currencies (no UAH), and a currency must not
      // disappear just because today's source doesn't cover it.
      const previous = await getLatestRates();
      return await ExchangeRateModel.findOneAndUpdate(
        { base: BASE },
        { $set: { rates: { ...previous?.rates, ...rates }, source: url, fetchedAt: new Date() } },
        { upsert: true, new: true }
      ).lean();
    } catch (error) {
      console.log("rates refresh failed:", error.message);
    }
  }
  return null;
};

// Checks hourly instead of firing at a fixed time: a free Render instance sleeps, and on wake-up the first check
// catches up straight away.
export const startRatesJob = () => {
  const tick = async () => {
    const latest = await getLatestRates();
    if (!latest || Date.now() - new Date(latest.fetchedAt).getTime() > STALE_AFTER_MS) {
      await refreshRates();
    }
  };
  const run = () => tick().catch((error) => console.log("rates job error:", error));
  run();
  setInterval(run, HOUR_MS).unref();
};
