// Builds the release APK on this computer instead of EAS (npm run apk; npm run apk -- --clean regenerates android/
// from scratch). Uses the "preview" profile's environment from eas.json (the Render API address, not the local one
// from .env) and signs with the EAS key from credentials.json, so the APK installs over the current app.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const fail = (message) => {
  console.error(`\n${message}`);
  process.exit(1);
};

if (!fs.existsSync(path.join(root, "credentials.json"))) {
  fail("credentials.json is missing: run `npx eas-cli@latest credentials -p android` -> credentials.json -> Download.");
}
for (const name of ["ANDROID_HOME", "JAVA_HOME"]) {
  if (!process.env[name]) fail(`${name} is not set (open a new terminal after setting it).`);
}

const profile = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8")).build.preview;
const env = { ...process.env, ...profile.env, NODE_ENV: "production" };

const run = (command, args, cwd) => {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) fail(`Failed: ${command} ${args.join(" ")}`);
};

const clean = process.argv.includes("--clean");
run("npx", ["expo", "prebuild", "--platform", "android", "--no-install", ...(clean ? ["--clean"] : [])], root);
const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
run(gradlew, ["assembleRelease"], path.join(root, "android"));

const built = path.join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const target = path.join(root, "MyBudget.apk");
fs.copyFileSync(built, target);
console.log(`\nAPK ready: ${target}`);
