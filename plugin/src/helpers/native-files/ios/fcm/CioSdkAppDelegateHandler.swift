import Foundation
import CioMessagingPushFCM
import FirebaseCore
import FirebaseMessaging
import UserNotifications
import UIKit

public class CioSdkAppDelegateHandler: NSObject {
    
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {

    {{REGISTER_SNIPPET}}

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

  public func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    
  }
    
  public func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    
  }
}

extension CioSdkAppDelegateHandler: MessagingDelegate {
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
