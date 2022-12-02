import Foundation
import CioMessagingPushAPN
import CioTracking
import UserNotifications
import UIKit

@objc
public class CIOAppPushNotificationsHandler : NSObject {

  public override init() {}

  @objc(registerPushNotification:)
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
  }

  @objc(application:deviceToken:)
  public func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    MessagingPush.shared.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  @objc(application:error:)
  public func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    MessagingPush.shared.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  @objc(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:)
  public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    let handled = MessagingPush.shared.userNotificationCenter(center, didReceive: response,
  withCompletionHandler: completionHandler)

    // If the Customer.io SDK does not handle the push, it's up to you to handle it and call the
    // completion handler. If the SDK did handle it, it called the completion handler for you.
    if !handled {
      completionHandler()
    }
  }
}
