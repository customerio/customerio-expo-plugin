export const LOCAL_PATH_TO_CIO_NSE_FILES = `./node_modules/customerio-expo-plugin/src/helpers/native-files/ios`;
export const IOS_DEPLOYMENT_TARGET = '13.0';
export const CIO_SDK_VERSION = '1.2.6';
export const CIO_PODFILE_REGEX = /pod 'CustomerIO\/MessagingPushAPN'/;
export const CIO_CIO_TARGET_REGEX = /cio_target_names/;
export const CIO_PODFILE_NOTIFICATION_REGEX = /target 'NotificationService' do/;
export const GROUP_IDENTIFIER_TEMPLATE_REGEX = /{{GROUP_IDENTIFIER}}/gm;
export const BUNDLE_SHORT_VERSION_TEMPLATE_REGEX = /{{BUNDLE_SHORT_VERSION}}/gm;
export const BUNDLE_VERSION_TEMPLATE_REGEX = /{{BUNDLE_VERSION}}/gm;
export const CIO_PODFILE_POST_INSTALL_REGEX = /post_install do \|installer\|/;
export const CIO_DIDFINISHLAUNCHINGMETHOD_REGEX =
  /(- \(BOOL\)application:\(UIApplication \*\)application didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions(\s|\n)*?\{)((.|\n)*)\[super(\s)application:application(\s)didFinishLaunchingWithOptions:launchOptions\];/;

export const CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_REGEX =
  /return \[super application:application didFailToRegisterForRemoteNotificationsWithError:error\];/;

export const CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERRORFULL_REGEX =
  /(- \(void\)application:\(UIApplication \*\)application didFailToRegisterForRemoteNotificationsWithError:\(NSError \*\)error(\s|\n)*?\{)(.|\n){2}.*\n\}/;

export const CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_REGEX =
  /return \[super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken\];/;

export const CIO_APPDELEGATEDECLARATION_REGEX =
  /@implementation AppDelegate(.|\n)/;

export const CIO_APPDELEGATEHEADER_REGEX =
  /@interface AppDelegate : EXAppDelegateWrapper <RCTBridgeDelegate>/;
export const DEFAULT_BUNDLE_VERSION = '1';
export const DEFAULT_BUNDLE_SHORT_VERSION = '1.0';
export const CIO_TARGET_NAME = 'CustomerIOSDK';
export const CIO_NOTIFICATION_TARGET_NAME = 'NotificationService';
export const CIO_APPDELEGATEHEADER_SNIPPET = `
#import <UserNotifications/UserNotifications.h>

@interface AppDelegate : EXAppDelegateWrapper <RCTBridgeDelegate, UNUserNotificationCenterDelegate>
`;

export const CIO_PUSHNOTIFICATIONHANDLERDECLARATION_SNIPPET = `
CIOAppPushNotificationsHandler* pnHandlerObj = [[CIOAppPushNotificationsHandler alloc] init];
`;

export const CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_SNIPPET = `
  [pnHandlerObj application:application error:error];
`;

export const CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_SNIPPET = `
  return [pnHandlerObj application:application deviceToken:deviceToken];
`;

// Configure Customerio push notifications SDK by adding to application:didFinishLaunchingWithOptions: delegate method
// From Braze docs: https://www.customer.io/docs/sdk/react-native/push/#obj-c-push
export const CIO_CONFIGURECIOSDKPUSHNOTIFICATION_SNIPPET = `
  // Register for push notifications
  [pnHandlerObj registerPushNotification:self];
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
export const CIO_PODFILE_SNIPPET = `  pod 'CustomerIO/MessagingPushAPN', '~> ${CIO_SDK_VERSION}'`;
export const CIO_PODFILE_NOTIFICATION_SNIPPET = `
target '${CIO_NOTIFICATION_TARGET_NAME}' do
${CIO_PODFILE_SNIPPET}
end`;
export const CIO_PODFILE_NOTIFICATION_STATIC_FRAMEWORK_SNIPPET = `
target '${CIO_NOTIFICATION_TARGET_NAME}' do
  use_frameworks! :linkage => :static
${CIO_PODFILE_SNIPPET}
end`;
export const CIO_PODFILE_TARGET_NAMES_SNIPPET = `
  cio_target_names = [
    'CustomerIOTracking',
    'CustomerIOCommon',
    'CustomerIOMessagingPushAPN',
    'CustomerIOMessagingPush'
  ]`;
export const CIO_PODFILE_POST_INSTALL_SNIPPET = `
    installer.pods_project.targets.each do |target|
      if cio_target_names.include? target.name
        puts "Modifying target #{target.name}"

        target.build_configurations.each do |config|
          puts "Setting build config settings for #{target.name}"
          config.build_settings['APPLICATION_EXTENSION_API_ONLY'] ||= 'NO'
        end
      end
    end`;
export const CIO_PODFILE_POST_INSTALL_FALLBACK_SNIPPET = `
cio_target_names = [
  'CustomerIOTracking',
  'CustomerIOCommon',
  'CustomerIOMessagingPushAPN',
  'CustomerIOMessagingPush'
]

post_install do |installer|

  installer.pods_project.targets.each do |target|
    if cio_target_names.include? target.name
      puts "Modifying target #{target.name}"

      target.build_configurations.each do |config|
        puts "Setting build config settings for #{target.name}"
        config.build_settings['APPLICATION_EXTENSION_API_ONLY'] ||= 'NO'
      end
    end
  end
  react_native_post_install(installer)
  __apply_Xcode_12_5_M1_post_install_workaround(installer)
end`;
