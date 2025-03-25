const finder = require('find-package-json');
const path = require('path');
const resolveFrom = require('resolve-from');

const f = finder(__dirname);
let pluginPackageRoot = f.next().filename;
// This is the path to the root of the customerio-expo-plugin package
pluginPackageRoot = path.dirname(pluginPackageRoot);

export const LOCAL_PATH_TO_CIO_NSE_FILES = path.join(
  pluginPackageRoot,
  'plugin/src/helpers/native-files/ios'
);

export function getRelativePathToRNSDK(iosPath: string) {
  // Root path of the Expo project
  const rootAppPath = path.dirname(iosPath);

  // Path of the cio RN package.json file. Example: test-app/node_modules/customerio-reactnative/package.json
  const pluginPackageJsonPath = resolveFrom.silent(rootAppPath, `customerio-reactnative/package.json`);

  // Example: ../node_modules/customerio-reactnative
  return path.relative(iosPath, path.dirname(pluginPackageJsonPath));
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
