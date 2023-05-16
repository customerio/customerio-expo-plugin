export const LOCAL_PATH_TO_CIO_NSE_FILES = `./node_modules/customerio-expo-plugin/src/helpers/native-files/ios`;
export const IOS_DEPLOYMENT_TARGET = '13.0';
export const CIO_SDK_VERSION = "'~> 2.0'";
export const CIO_PODFILE_REGEX = /pod 'CustomerIO\/MessagingPushAPN'/;
export const CIO_CIO_TARGET_REGEX = /cio_target_names/;
export const CIO_PODFILE_NOTIFICATION_REGEX = /target 'NotificationService' do/;
export const CIO_PODFILE_POST_INSTALL_REGEX = /post_install do \|installer\|/;
export const GROUP_IDENTIFIER_TEMPLATE_REGEX = /{{GROUP_IDENTIFIER}}/gm;
export const BUNDLE_SHORT_VERSION_TEMPLATE_REGEX = /{{BUNDLE_SHORT_VERSION}}/gm;
export const BUNDLE_VERSION_TEMPLATE_REGEX = /{{BUNDLE_VERSION}}/gm;

export const DEFAULT_BUNDLE_VERSION = '1';
export const DEFAULT_BUNDLE_SHORT_VERSION = '1.0';
export const CIO_TARGET_NAME = 'CustomerIOSDK';
export const CIO_NOTIFICATION_TARGET_NAME = 'NotificationService';
export const CIO_PODFILE_SNIPPET = `  pod 'CustomerIO/MessagingPushAPN', ${CIO_SDK_VERSION}`;
export const CIO_PODFILE_NOTIFICATION_SNIPPET = `
target '${CIO_NOTIFICATION_TARGET_NAME}' do
${CIO_PODFILE_SNIPPET}
end`;
export const CIO_PODFILE_NOTIFICATION_STATIC_FRAMEWORK_SNIPPET = `
target '${CIO_NOTIFICATION_TARGET_NAME}' do
  use_frameworks! :linkage => :static
${CIO_PODFILE_SNIPPET}
end`;

export const CIO_REGISTER_PUSHNOTIFICATION_SNIPPET = `
public func registerPushNotification(withNotificationDelegate notificationDelegate: UNUserNotificationCenterDelegate) {

      let center  = UNUserNotificationCenter.current()
      center.delegate = notificationDelegate
      center.requestAuthorization(options: [.sound, .alert, .badge]) { (granted, error) in
        if error == nil{
          DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
          }
        }
      }
    }`;
