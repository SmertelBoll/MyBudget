// The English dictionary lives in backend/i18n/en.json (it is also seeded into the database). The app bundles a
// copy as the offline fallback (spec 2.4). Run after changing en.json: npm run i18n:copy
const fs = require("fs");
const path = require("path");

const from = path.join(__dirname, "..", "..", "backend", "i18n", "en.json");
const to = path.join(__dirname, "..", "src", "i18n", "en.json");
fs.copyFileSync(from, to);
console.log(`copied ${Object.keys(JSON.parse(fs.readFileSync(to, "utf8"))).length} keys`);
