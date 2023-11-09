import Foundation
import CioMessagingPushAPN
import CioTracking
import UserNotifications
import UIKit

@objc
public class CIOAppPushNotificationsHandler : NSObject {

  public override init() {}

  {{REGISTER_SNIPPET}}

  @objc(initializeCioSdk)
  public func initializeCioSdk() {
    let configAutoTrackPushEvents = {{AUTO_TRACK_PUSH_EVENTS}}

    CustomerIO.initialize(siteId: "{{SITE_ID}}", apiKey: "{{API_KEY}}", region: .{{REGION}}) { config in
      config.autoTrackPushEvents = configAutoTrackPushEvents
    }

    if configAutoTrackPushEvents {
      MessagingPush.initialize()
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
}
