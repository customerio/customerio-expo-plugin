import fs from 'fs';
import * as semver from 'semver';

const path = require('path');
import { resolveRNSDK, tryReadRNVersion } from '../../utils/resolveRNSDK';
import { logger } from '../../utils/logger';

// Threshold at which React Native pod autolinking moves from
// @react-native-community/cli (lexical, symlink-preserving) to
// expo-modules-autolinking (realpath). The two flavors emit different
// :path strings on pnpm/yarn-symlink layouts, so to keep CocoaPods happy
// we must match whichever flavor will resolve the same package later.
const RN_REALPATH_AUTOLINKING_MIN_VERSION = '0.80.0';

/**
 * Returns the relative path from the iOS project dir to the installed
 * customerio-reactnative directory, in the exact form React Native pod
 * autolinking will emit for the same package. The two autolinking
 * flavors disagree on path shape under pnpm/yarn symlinks:
 *
 *   - RN <0.80 (`@react-native-community/cli`): walks node_modules
 *     lexically, preserves symlinks. We keep the symlink path too —
 *     `tryResolveRNSDK` already does this without calling realpath.
 *
 *   - RN >=0.80 (`expo-modules-autolinking`): realpaths the package
 *     via Node, emitting the underlying `.pnpm/...` (or yarn-classic)
 *     path. We match by realpath'ing the resolved directory.
 *
 * Decision points are logged through the shared logger, gated by
 * CUSTOMERIO_DEBUG_MODE. Defaulting to silent keeps the prebuild output
 * clean for hosts that parse it (Expo's `--json` config, EAS build
 * tooling), while still giving support a "rerun with this flag" path
 * for triaging path-resolution issues.
 */
export function getRelativePathToRNSDK(iosPath: string) {
  const rootAppPath = path.dirname(iosPath);
  logger.info(
    `Resolving customerio-reactnative for Podfile (iosPath=${iosPath}, projectRoot=${rootAppPath})`
  );

  const { packageDir } = resolveRNSDK(rootAppPath);
  logger.info(`customerio-reactnative resolved to: ${packageDir}`);

  const rnVersion = tryReadRNVersion(rootAppPath);
  logger.info(`Detected react-native version: ${rnVersion ?? 'unknown'}`);

  const useLexical = shouldUseLexicalPath(rnVersion);
  logger.info(
    useLexical
      ? `RN <${RN_REALPATH_AUTOLINKING_MIN_VERSION} — using lexical/symlink path to match @react-native-community/cli autolinking`
      : `RN >=${RN_REALPATH_AUTOLINKING_MIN_VERSION} or unknown — using realpath to match expo-modules-autolinking`
  );

  let absolutePath: string;
  if (useLexical) {
    absolutePath = packageDir;
  } else {
    try {
      absolutePath = fs.realpathSync(packageDir);
      if (absolutePath !== packageDir) {
        logger.info(`Realpath differs from resolved dir: ${absolutePath}`);
      }
    } catch (err) {
      logger.warn(
        `realpathSync failed (${
          err instanceof Error ? err.message : String(err)
        }); falling back to symlink path`
      );
      absolutePath = packageDir;
    }
  }

  const relativePath = path.relative(iosPath, absolutePath);
  logger.info(`Final Podfile :path => '${relativePath}'`);
  return relativePath;
}

function shouldUseLexicalPath(rnVersion: string | null): boolean {
  if (!rnVersion) {
    // Modern Expo (realpath) has been the working path for the last few
    // SDKs, so it's the safer default when RN can't be detected.
    return false;
  }
  const coerced = semver.valid(rnVersion) || semver.coerce(rnVersion);
  if (!coerced) {
    return false;
  }
  return semver.lt(coerced, RN_REALPATH_AUTOLINKING_MIN_VERSION);
}

export const IOS_DEPLOYMENT_TARGET = '13.0';
export const GROUP_IDENTIFIER_TEMPLATE_REGEX = /{{GROUP_IDENTIFIER}}/gm;
export const BUNDLE_SHORT_VERSION_TEMPLATE_REGEX = /{{BUNDLE_SHORT_VERSION}}/gm;
export const BUNDLE_VERSION_TEMPLATE_REGEX = /{{BUNDLE_VERSION}}/gm;
export const CIO_DIDFINISHLAUNCHINGMETHOD_REGEX =
  /.*\[super(\s)application:application(\s)didFinishLaunchingWithOptions:launchOptions\];/;

export const CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_REGEX =
  /return \[super application:application didFailToRegisterForRemoteNotificationsWithError:error\];/;

export const CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERRORFULL_REGEX =
  /(- \(void\)application:\(UIApplication \*\)application didFailToRegisterForRemoteNotificationsWithError:\(NSError \*\)error(\s|\n)*?\{)(.|\n){2}.*\n\}/;

export const CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_REGEX =
  /return \[super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken\];/;

export const CIO_APPDELEGATEDECLARATION_REGEX =
  /@implementation AppDelegate(.|\n)/;

export const CIO_APPDELEGATEHEADER_REGEX =
  /(@interface AppDelegate\s*:\s*EXAppDelegateWrapper\s*)(<([^>]+)>)?/;

export const CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_REGEX =
  /^\s*RCTBridge\s*\*\s*\w+\s*=\s*\[\s*self\.reactDelegate\s+createBridgeWithDelegate:self\s+launchOptions:launchOptions\s*\];\s*$/gm;

export const CIO_LAUNCHOPTIONS_DEEPLINK_MODIFIEDOPTIONS_REGEX =
  /^\s*return\s\[\s*super\s*application:\s*application\s*didFinishLaunchingWithOptions\s*:\s*launchOptions\s*\];/gm;

export const CIO_DEEPLINK_COMMENT_REGEX =
  /\sDeep link workaround for app killed state start/gm;
export const DEFAULT_BUNDLE_VERSION = '1';
export const DEFAULT_BUNDLE_SHORT_VERSION = '1.0';
export const CIO_TARGET_NAME = 'CustomerIOSDK';
export const CIO_NOTIFICATION_TARGET_NAME = 'NotificationService';
export const CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME = 'CIOLiveActivityWidget';
// Live Activities require iOS 16.2+; used as the injected widget extension's deployment target.
export const DEFAULT_LIVE_ACTIVITY_DEPLOYMENT_TARGET = '16.2';

export const CIO_APPDELEGATEHEADER_IMPORT_SNIPPET = `#import <UserNotifications/UserNotifications.h>`;
export const CIO_APPDELEGATEHEADER_USER_NOTIFICATION_CENTER_SNIPPET =
  'UNUserNotificationCenterDelegate';
export const CIO_PUSHNOTIFICATIONHANDLERDECLARATION_SNIPPET = `
CIOAppPushNotificationsHandler* pnHandlerObj = [[CIOAppPushNotificationsHandler alloc] init];
`;
export const CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_SNIPPET = `
RCTBridge *bridge = [self.reactDelegate createBridgeWithDelegate:self launchOptions:modifiedLaunchOptions];
`;

export const CIO_LAUNCHOPTIONS_MODIFIEDOPTIONS_SNIPPET = `
return [super application:application didFinishLaunchingWithOptions:modifiedLaunchOptions];`;

export const CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_SNIPPET = `
  [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
  [pnHandlerObj application:application error:error];
`;

export const CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_SNIPPET = `
  [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
  return [pnHandlerObj application:application deviceToken:deviceToken];
`;

export const CIO_CONFIGURECIOSDKPUSHNOTIFICATION_SNIPPET = `
  // Register for push notifications
  [pnHandlerObj registerPushNotification];
`;

export const CIO_INITIALIZECIOSDK_SNIPPET = `  
  [pnHandlerObj initializeCioSdk];

// Code to make the CIO SDK compatible with expo-notifications package.
// 
// The CIO SDK and expo-notifications both need to handle when a push gets clicked. However, iOS only allows one click handler to be set per app.
// To get around this limitation, we set the CIO SDK as the click handler. The CIO SDK sets itself up so that when another SDK or host iOS app 
// sets itself as the click handler, the CIO SDK will still be able to handle when the push gets clicked, even though it's not the designated 
// click handler in iOS at runtime. 
// 
// This should work for most SDKs. However, expo-notifications is unique in it's implementation. It will not setup push click handling it if detects 
// that another SDK or host iOS app has already set itself as the click handler:
// https://github.com/expo/expo/blob/1b29637bec0b9888e8bc8c310476293a3e2d9786/packages/expo-notifications/ios/EXNotifications/Notifications/EXNotificationCenterDelegate.m#L31-L37
// ...to get around this, we must manually set it as the click handler after the CIO SDK. That's what this code block does.
//
// Note: Initialize the native iOS SDK and setup SDK push click handling before running this code. 
# if __has_include(<EXNotifications/EXNotificationCenterDelegate.h>)
  // Creating a new instance, as the comments in expo-notifications suggests, does not work. With this code, if you send a CIO push to device and click on it,
  // no push metrics reporting will occur.
  // EXNotificationCenterDelegate *notificationCenterDelegate = [[EXNotificationCenterDelegate alloc] init];

  // ...instead, get the singleton reference from Expo. 
  id<UNUserNotificationCenterDelegate> notificationCenterDelegate = (id<UNUserNotificationCenterDelegate>) [EXModuleRegistryProvider getSingletonModuleForClass:[EXNotificationCenterDelegate class]];
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  center.delegate = notificationCenterDelegate;
# endif
`;

export const CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SNIPPET = `
// Deep link workaround for app killed state start
NSMutableDictionary *modifiedLaunchOptions = [NSMutableDictionary dictionaryWithDictionary:launchOptions];
  if (launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey]) {
      NSDictionary *pushContent = launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey];
      if (pushContent[@"CIO"] && pushContent[@"CIO"][@"push"] && pushContent[@"CIO"][@"push"][@"link"]) {
        NSString *initialURL = pushContent[@"CIO"][@"push"][@"link"];
          if (!launchOptions[UIApplicationLaunchOptionsURLKey]) {
              modifiedLaunchOptions[UIApplicationLaunchOptionsURLKey] = [NSURL URLWithString:initialURL];
          }
      }
  }
//Deep link workaround for app killed state ends
`;

export const CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SWIFT_SNIPPET = `
    // Deep link workaround for app killed state start
    var modifiedLaunchOptions = launchOptions
    if let launchOptions = launchOptions,
       let pushContent = launchOptions[UIApplication.LaunchOptionsKey.remoteNotification] as? [AnyHashable: Any],
       let cio = pushContent["CIO"] as? [String: Any],
       let push = cio["push"] as? [String: Any],
       let link = push["link"] as? String,
       !launchOptions.keys.contains(UIApplication.LaunchOptionsKey.url) {
        
        var mutableLaunchOptions = launchOptions
        mutableLaunchOptions[UIApplication.LaunchOptionsKey.url] = URL(string: link)
        modifiedLaunchOptions = mutableLaunchOptions
    }
    // Deep link workaround for app killed state ends
`;

export const CIO_REGISTER_PUSHNOTIFICATION_SNIPPET = `
@objc(registerPushNotification)
  public func registerPushNotification() {

    let center  = UNUserNotificationCenter.current()
    center.requestAuthorization(options: [.sound, .alert, .badge]) { (granted, error) in
      if error == nil{
        DispatchQueue.main.async {
          UIApplication.shared.registerForRemoteNotifications()
        }
      }
    }
  }`;

export const CIO_REGISTER_PUSHNOTIFICATION_SNIPPET_v2 = `
    let center  = UNUserNotificationCenter.current()
    center.requestAuthorization(options: [.sound, .alert, .badge]) { (granted, error) in
      if error == nil{
        DispatchQueue.main.async {
          UIApplication.shared.registerForRemoteNotifications()
        }
      }
    }`;

export const CIO_REGISTER_PUSH_NOTIFICATION_PLACEHOLDER = /\{\{REGISTER_SNIPPET\}\}/;
// Regex to match MessagingPush initialization in AppDelegate (different from NSE initialization)
export const CIO_MESSAGING_PUSH_APP_DELEGATE_INIT_REGEX = /(MessagingPush(?:APN|FCM)\.initialize)/;
export const CIO_NATIVE_SDK_INITIALIZE_CALL = 'CustomerIOSDKInitializer.initialize()';
export const CIO_NATIVE_SDK_INITIALIZE_SNIPPET = `// Auto Initialize Native Customer.io SDK
    ${CIO_NATIVE_SDK_INITIALIZE_CALL}
    `;
