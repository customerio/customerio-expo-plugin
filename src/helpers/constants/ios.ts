const finder = require('find-package-json');
const path = require('path');

const f = finder(__dirname);
let pluginPackageRoot = f.next().filename;
// This is the path to the root of the customerio-expo-plugin package
pluginPackageRoot = path.dirname(pluginPackageRoot);

export const LOCAL_PATH_TO_CIO_NSE_FILES = path.join(
  pluginPackageRoot,
  'src/helpers/native-files/ios'
);
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

export const DEFAULT_BUNDLE_VERSION = '1';
export const DEFAULT_BUNDLE_SHORT_VERSION = '1.0';
export const CIO_TARGET_NAME = 'CustomerIOSDK';
export const CIO_NOTIFICATION_TARGET_NAME = 'NotificationService';

export const CIO_APPDELEGATEHEADER_IMPORT_SNIPPET = `#import <UserNotifications/UserNotifications.h>`;
export const CIO_APPDELEGATEHEADER_USER_NOTIFICATION_CENTER_SNIPPET = 'UNUserNotificationCenterDelegate';
export const CIO_PUSHNOTIFICATIONHANDLERDECLARATION_SNIPPET = `
CIOAppPushNotificationsHandler* pnHandlerObj = [[CIOAppPushNotificationsHandler alloc] init];
`;
export const CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_SNIPPET = `
RCTBridge *bridge = [self.reactDelegate createBridgeWithDelegate:self launchOptions:modifiedLaunchOptions];
`;

export const CIO_LAUNCHOPTIONS_MODIFIEDOPTIONS_SNIPPET = `
return [super application:application didFinishLaunchingWithOptions:modifiedLaunchOptions];`

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

export const CIO_CONFIGURECIOSDKUSERNOTIFICATIONCENTER_SNIPPET = `
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  center.delegate = self;
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

// Enable push handling - notification response
export const CIO_DIDRECEIVENOTIFICATIONRESPONSEHANDLER_SNIPPET = `
- (void)userNotificationCenter:(UNUserNotificationCenter *)center didReceiveNotificationResponse:(UNNotificationResponse *)response withCompletionHandler:(void(^)(void))completionHandler {
  [pnHandlerObj userNotificationCenter:center didReceiveNotificationResponse:response withCompletionHandler:completionHandler];
}`;

// Foreground push handling
export const CIO_WILLPRESENTNOTIFICATIONHANDLER_SNIPPET = `
// show push when the app is in foreground
- (void)userNotificationCenter:(UNUserNotificationCenter* )center willPresentNotification:(UNNotification* )notification withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler {
  completionHandler( UNNotificationPresentationOptionAlert + UNNotificationPresentationOptionSound);
}`;
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
