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

// Windows: the C++ parts (worklets, Skia) build in folders far past 260 characters. That needs long paths switched on
// in Windows (once, as administrator) and a ninja new enough to use them (1.12, shipped with CMake 3.31+; the CMake
// 3.22 that Gradle installs by itself has 1.10, which fails with "mkdir(...): No such file or directory").
let cmakeDir = null;
if (process.platform === "win32") {
  const reg = spawnSync("reg", ["query", "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem", "/v", "LongPathsEnabled"], { encoding: "utf8" });
  if (!/LongPathsEnabled\s+REG_DWORD\s+0x1/.test(reg.stdout ?? "")) {
    fail(
      "Long paths are off in Windows, and the C++ part of the build fails without them. In PowerShell run as administrator:\n" +
        '  Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" -Name LongPathsEnabled -Value 1\n' +
        "then restart the computer and run npm run apk again."
    );
  }
  const cmakeRoot = path.join(androidHome, "cmake");
  const version = (name) => name.split(".").map(Number);
  const newest = (fs.existsSync(cmakeRoot) ? fs.readdirSync(cmakeRoot) : [])
    .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
    .sort((a, b) => {
      const [x, y] = [version(a), version(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    })
    .pop();
  if (!newest || version(newest)[0] < 3 || (version(newest)[0] === 3 && version(newest)[1] < 31)) {
    fail("CMake 3.31 or newer is needed: Android Studio -> SDK Manager -> SDK Tools -> CMake.");
  }
  cmakeDir = path.join(cmakeRoot, newest);
}

const clean = process.argv.includes("--clean");
run("npx", ["expo", "prebuild", "--platform", "android", "--no-install", ...(clean ? ["--clean"] : [])], root);

// Gradle reads the SDK and the CMake to use from here (the file is generated, android/ isn't in git).
const escape = (value) => value.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
const localProperties = [`sdk.dir=${escape(androidHome)}`, ...(cmakeDir ? [`cmake.dir=${escape(cmakeDir)}`] : [])];
fs.writeFileSync(path.join(root, "android", "local.properties"), localProperties.join("\n") + "\n");

const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
// Phones are arm64: building the native code for that one processor type takes a quarter of the time (EAS still
// builds all four).
run(gradlew, ["assembleRelease", "-PreactNativeArchitectures=arm64-v8a"], path.join(root, "android"));

const built = path.join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const target = path.join(root, "MyBudget.apk");
fs.copyFileSync(built, target);
console.log(`\nAPK ready: ${target}`);
