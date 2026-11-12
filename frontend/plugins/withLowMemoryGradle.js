// Release builds on EAS's free machine (4 cores, ~15 GB) ran out of memory twice: Gradle compiled the native code of
// Skia, Reanimated and the rest for all four processor types at once, and the system killed the build. At most two
// Gradle tasks at a time keeps it in memory; the build takes a little longer.
const { withGradleProperties } = require("expo/config-plugins");

const SETTINGS = { "org.gradle.workers.max": "2" };

module.exports = function withLowMemoryGradle(config) {
  return withGradleProperties(config, (gradle) => {
    for (const [key, value] of Object.entries(SETTINGS)) {
      gradle.modResults = gradle.modResults.filter((item) => !(item.type === "property" && item.key === key));
      gradle.modResults.push({ type: "property", key, value });
    }
    return gradle;
  });
};
