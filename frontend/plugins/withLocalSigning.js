// Local APK builds (npm run apk) sign with the same key as EAS, so they install over an app built there. The key and
// its passwords come from credentials.json (eas credentials -> Download credentials from EAS), which stays out of git
// and out of EAS uploads. Without that file (on EAS), nothing changes: EAS signs the build itself.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARK = "// withLocalSigning";

const READ_CREDENTIALS = `${MARK}
def localCredentialsFile = rootProject.file("../credentials.json")
def localKeystore = localCredentialsFile.exists() ? new groovy.json.JsonSlurper().parse(localCredentialsFile).android?.keystore : null
`;

const RELEASE_CONFIG = `
        if (localKeystore) {
            release {
                storeFile rootProject.file("../" + localKeystore.keystorePath)
                storePassword localKeystore.keystorePassword
                keyAlias localKeystore.keyAlias
                keyPassword localKeystore.keyPassword
            }
        }`;

module.exports = function withLocalSigning(config) {
  return withAppBuildGradle(config, (gradle) => {
    let text = gradle.modResults.contents;
    if (text.includes(MARK)) return gradle;

    const steps = [
      [/\nandroid \{/, (match) => `\n${READ_CREDENTIALS}${match}`],
      [/signingConfigs \{/, (match) => `${match}${RELEASE_CONFIG}`],
      [
        /(release \{[^}]*?)signingConfig signingConfigs\.debug/,
        (_, before) => `${before}signingConfig localKeystore ? signingConfigs.release : signingConfigs.debug`,
      ],
    ];
    for (const [pattern, replace] of steps) {
      if (!pattern.test(text)) throw new Error(`withLocalSigning: app/build.gradle has no ${pattern}`);
      text = text.replace(pattern, replace);
    }
    gradle.modResults.contents = text;
    return gradle;
  });
};
