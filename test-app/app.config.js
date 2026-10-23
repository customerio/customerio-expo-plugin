// Build variants on top of app.json (https://docs.expo.dev/tutorial/eas/multiple-app-variants/).
// APP_VARIANT=fid registers the Firebase Installation ID instead of the FCM token. Both variants use
// the same app IDs, so only one can be installed at a time.
const { withAppBuildGradle } = require('expo/config-plugins');

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

module.exports = ({ config }) => {
  const customerIO = config.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'customerio-expo-plugin'
  );
  customerIO[1].firebaseInstallationId = { enabled: IS_FID };

  return withFidFirebaseMessaging(config);
};
