// Build variants on top of app.json (https://docs.expo.dev/tutorial/eas/multiple-app-variants/).
// APP_VARIANT=fid registers the Firebase Installation ID instead of the FCM token. Both variants use
// the same app IDs, so only one can be installed at a time.
const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withFinalizedMod } = require('expo/config-plugins');

const IS_FID = process.env.APP_VARIANT === 'fid';

// FID needs firebase-messaging 25.1.0+; the Customer.io Android SDK compiles against an older one
const FID_FIREBASE_MESSAGING =
  'implementation "com.google.firebase:firebase-messaging:25.1.3"';

const withFidFirebaseMessaging = (config) =>
  withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents
      .split('\n')
      .filter((line) => line.trim() !== FID_FIREBASE_MESSAGING)
      .join('\n');
    cfg.modResults.contents = IS_FID
      ? contents.replace(
          /^dependencies\s*{/m,
          (match) => `${match}\n    ${FID_FIREBASE_MESSAGING}`
        )
      : contents;
    return cfg;
  });

// Regression guard for MBL-2650: a Swift pod with no `swift_versions` shared by the app and the
// NotificationService target. CocoaPods takes its Swift version from the targets that use it, so
// `pod install` fails if the plugin gives the NSE a different Swift version than the app.
// A local pod is used on purpose: public pods such as GzipSwift 5.1.1 declare `swift_versions`,
// which hides the mismatch. See shared-swift-pod/CioSharedSwiftPod.podspec.
const SHARED_SWIFT_POD = "  pod 'CioSharedSwiftPod', :path => '../shared-swift-pod'";

// Runs after the Customer.io plugin has written the NotificationService block to the Podfile.
const withSharedSwiftPod = (config) =>
  withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      // Drop previous copies first: an incremental prebuild rewrites the plugin's NotificationService
      // block, which removes this line from that target but leaves it in the app target.
      let contents = fs
        .readFileSync(podfile, 'utf8')
        .split('\n')
        .filter((line) => !line.includes('CioSharedSwiftPod'))
        .join('\n');
      for (const target of [cfg.modRequest.projectName, 'NotificationService']) {
        contents = contents.replace(
          new RegExp(`^target '${target}' do$`, 'm'),
          (match) => `${match}\n${SHARED_SWIFT_POD}`
        );
      }
      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);

module.exports = ({ config }) => {
  const customerIO = config.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'customerio-expo-plugin'
  );
  customerIO[1].firebaseInstallationId = { enabled: IS_FID };

  return withSharedSwiftPod(withFidFirebaseMessaging(config));
};
