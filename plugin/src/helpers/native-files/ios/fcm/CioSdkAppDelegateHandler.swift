import Foundation
import CioMessagingPushFCM
import CioFirebaseWrapper
@_spi(Internal) import CioMessagingPush
import FirebaseCore
import FirebaseMessaging
import UserNotifications
import UIKit
#if canImport(EXNotifications)
import EXNotifications
import ExpoModulesCore
#endif

private class DummyAppDelegate: NSObject, UIApplicationDelegate, MessagingDelegate {
  func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {}
}

public class CioSdkAppDelegateHandler: NSObject {

  private let cioAppDelegate = CioAppDelegateWrapper<DummyAppDelegate>()
    
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {

    {{REGISTER_SNIPPET}}

    if (FirebaseApp.app() == nil) {
      FirebaseApp.configure()
    }

    MessagingPush.appDelegateIntegratedExplicitly = true

    // Initialize the CIO SDK and setup push click handling first.
    MessagingPushFCM.initialize(
      withConfig: MessagingPushConfigBuilder()
        .autoFetchDeviceToken({{AUTO_FETCH_DEVICE_TOKEN}})
{{APP_GROUP_ID_BUILDER_LINE}}        .showPushAppInForeground({{SHOW_PUSH_APP_IN_FOREGROUND}})
        .autoTrackPushEvents({{AUTO_TRACK_PUSH_EVENTS}})
        .build()
    )

    _ = cioAppDelegate.application(application, didFinishLaunchingWithOptions: launchOptions)
    UIApplication.shared.registerForRemoteNotifications()

    // Code to make the CIO SDK compatible with expo-notifications package.
    //
    // The CIO SDK and expo-notifications both need to handle when a push gets clicked. However, iOS only allows one click handler to be set per app.
    // To get around this limitation, we set the CIO SDK as the click handler. The CIO SDK sets itself up so that when another SDK or host iOS app
    // sets itself as the click handler, the CIO SDK will still be able to handle when the push gets clicked, even though it's not the designated
    // click handler in iOS at runtime.
    //
    // This should work for most SDKs. However, expo-notifications is unique in its implementation. It will not setup push click handling if it detects
    // that another SDK or host iOS app has already set itself as the click handler.
    // To get around this, we must manually set expo-notifications as the click handler after the CIO SDK is initialized.
    #if canImport(EXNotifications)
    if let notificationCenterDelegate = ModuleRegistryProvider.getSingletonModule(for: NotificationCenterManager.self) as? UNUserNotificationCenterDelegate {
        let center = UNUserNotificationCenter.current()
        center.delegate = notificationCenterDelegate
      }
    #endif
  }

  public func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    
  }
    
  public func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    
  }
}
