import Foundation
import CioMessagingPushAPN
import UserNotifications
import UIKit

@objc
public class CIOAppPushNotificationsHandler : NSObject {

  public override init() {}

  {{REGISTER_SNIPPET}}

  @objc(initializeCioSdk)
  public func initializeCioSdk() {
    MessagingPushAPN.initialize(
      withConfig: MessagingPushConfigBuilder()
        .autoFetchDeviceToken({{AUTO_FETCH_DEVICE_TOKEN}})
        .showPushAppInForeground({{SHOW_PUSH_APP_IN_FOREGROUND}})
        .autoTrackPushEvents({{AUTO_TRACK_PUSH_EVENTS}})
        .build()
    )
  }

  @objc(application:deviceToken:)
  public func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    MessagingPush.shared.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  @objc(application:error:)
  public func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    MessagingPush.shared.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }
}
