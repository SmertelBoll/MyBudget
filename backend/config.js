import dns from "dns";
import * as dotenv from "dotenv";
dotenv.config({ quiet: true });

const list = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

// Local development only: some Windows setups (a local DNS proxy at 127.0.0.1) answer normal lookups but not the SRV
// query a mongodb+srv:// address needs, and the connection fails with "querySrv ECONNREFUSED".
const dnsServers = list(process.env.DNS_SERVERS);
if (dnsServers.length) dns.setServers(dnsServers);

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4444,
  mongoUri: process.env.MONGODB_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  // HMAC key for refresh-token hashes: a leaked database alone is not enough to forge a token.
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTtl: process.env.ACCESS_TTL || "15m",
  refreshIdleDays: Number(process.env.REFRESH_IDLE_DAYS) || 180,
  // Empty or unset means any domain (spec 3.1 / Q1); e.g. "gmail.com" restricts registration to that domain.
  allowedEmailDomains: list(process.env.ALLOWED_EMAIL_DOMAINS).map((d) => d.toLowerCase()),
  googleClientIds: list(process.env.GOOGLE_CLIENT_IDS),
  corsOrigins: list(process.env.CORS_ORIGINS),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  rates: {
    url: process.env.RATES_API_URL || "https://open.er-api.com/v6/latest/USD",
    fallbackUrl: process.env.RATES_FALLBACK_URL || "https://api.frankfurter.app/latest?from=USD",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || "MyBudget",
  },
  // Optional: without a token the sessions list has no city/country.
  ipinfoToken: process.env.IPINFO_TOKEN || "",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "",
  },
  supportEmail: process.env.SUPPORT_EMAIL || "",
};

const REQUIRED = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

export const assertConfig = () => {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing env variables: ${missing.join(", ")}`);
  }
};
