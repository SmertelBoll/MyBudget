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
// A terminal opened before ANDROID_HOME / JAVA_HOME were set doesn't see them: look in the usual install places too.
const firstExisting = (paths) => paths.find((item) => item && fs.existsSync(item));
const jdkIn = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /^jdk-17/.test(name)).sort().reverse().map((name) => path.join(dir, name)) : [];
const androidHome = firstExisting([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android", "Sdk"),
]);
const javaHome = firstExisting([process.env.JAVA_HOME, ...jdkIn("C:\\Program Files\\Microsoft"), ...jdkIn("C:\\Program Files\\Java")]);
if (!androidHome) fail("Android SDK not found: install it with Android Studio and set ANDROID_HOME.");
if (!javaHome) fail("JDK 17 not found: winget install Microsoft.OpenJDK.17, then set JAVA_HOME.");
console.log(`Android SDK: ${androidHome}\nJDK: ${javaHome}`);

const profile = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8")).build.preview;
// Windows spells it "Path"; a second "PATH" key next to it would be ambiguous.
const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
const env = {
  ...process.env,
  ...profile.env,
  NODE_ENV: "production",
  ANDROID_HOME: androidHome,
  JAVA_HOME: javaHome,
  [pathKey]: [path.join(javaHome, "bin"), path.join(androidHome, "platform-tools"), process.env[pathKey]].join(path.delimiter),
};

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
