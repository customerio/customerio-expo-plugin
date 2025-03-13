import Foundation
import CioMessagingPushFCM
import FirebaseCore
import FirebaseMessaging
import UserNotifications
import UIKit

@objc
public class CIOAppPushNotificationsHandler : NSObject {

  public override init() {}

  {{REGISTER_SNIPPET}}

  @objc(initializeCioSdk)
  public func initializeCioSdk() {
    if (FirebaseApp.app() == nil) {
      FirebaseApp.configure()
    }
    Messaging.messaging().delegate = self
    UIApplication.shared.registerForRemoteNotifications()
    
    MessagingPushFCM.initialize(
      withConfig: MessagingPushConfigBuilder()
        .autoFetchDeviceToken({{AUTO_FETCH_DEVICE_TOKEN}})
        .showPushAppInForeground({{SHOW_PUSH_APP_IN_FOREGROUND}})
        .autoTrackPushEvents({{AUTO_TRACK_PUSH_EVENTS}})
        .build()
    )
  }

  @objc(application:deviceToken:)
  public func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    // Do nothing for FCM version
    // This is not needed for FCM but keeping it to prevent modification or breaking compatibility with older versions
    // of Expo plugin
  }

  @objc(application:error:)
  public func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    // Do nothing for FCM version
    // This is not needed for FCM but keeping it to prevent modification or breaking compatibility with older versions
    // of Expo plugin
  }
}

extension CIOAppPushNotificationsHandler: MessagingDelegate {
  public func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    MessagingPush.shared.messaging(messaging, didReceiveRegistrationToken: fcmToken)
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.list, .banner, .badge, .sound])
  }
}
