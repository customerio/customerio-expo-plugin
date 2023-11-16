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
    // Must initialize Customer.io before initializing MessagingPushAPN. 
    CustomerIO.initialize(siteId: "{{SITE_ID}}", apiKey: "{{API_KEY}}", region: .{{REGION}}) { config in
      // Must configure auto track push events before initializing MessagingPushAPN. 
      // This is because after AppDelegate.didFinishLaunching is called, the app will start handling push click events. 
      // Configuring auto track push events after this point will not work.
      config.autoTrackPushEvents = {{AUTO_TRACK_PUSH_EVENTS}}
    }
    MessagingPushAPN.initialize()
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
