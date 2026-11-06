import { config } from "../config.js";

const PRIVATE_IP = /^(::1$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:(127|10|192\.168)\.|fc|fd|fe80)/i;

// Approximate "City, CC" for the sessions list. Best-effort: an empty string on any failure, and it never holds a
// login up for more than 2 s.
export const lookupLocation = async (ip) => {
  if (!config.ipinfoToken || !ip || PRIVATE_IP.test(ip)) return "";
  try {
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${config.ipinfoToken}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return "";
    const { city, country } = await res.json();
    return [city, country].filter(Boolean).join(", ");
  } catch {
    return "";
  }
};
