import Foundation
import UIKit
import UserNotifications
import CioMessagingPushAPN
#if canImport(EXNotifications)
import EXNotifications
import ExpoModulesCore
#endif

class DummyAppDelegate: NSObject, UIApplicationDelegate {}

public class CioSdkAppDelegateHandler: NSObject {

  let cioAppDelegate = CioAppDelegateWrapper<DummyAppDelegate>()
    
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {

    {{REGISTER_SNIPPET}}
    
    // Code to make the CIO SDK compatible with expo-notifications package.
    //
    // The CIO SDK and expo-notifications both need to handle when a push gets clicked. However, iOS only allows one click handler to be set per app.
    // To get around this limitation, we set the CIO SDK as the click handler. The CIO SDK sets itself up so that when another SDK or host iOS app
    // sets itself as the click handler, the CIO SDK will still be able to handle when the push gets clicked, even though it's not the designated
    // click handler in iOS at runtime.
    //
    // This should work for most SDKs. However, expo-notifications is unique in its implementation. It will not setup push click handling if it detects
    // that another SDK or host iOS app has already set itself as the click handler.
    // To get around this, we must manually set it as the click handler after the CIO SDK. That's what this code block does.
    //
    // Note: Initialize the native iOS SDK and setup SDK push click handling before running this code.
    #if canImport(EXNotifications)
      // Getting the singleton reference from Expo
    if let notificationCenterDelegate = ModuleRegistryProvider.getSingletonModule(for: NotificationCenterManager.self) as? UNUserNotificationCenterDelegate {
        let center = UNUserNotificationCenter.current()
        center.delegate = notificationCenterDelegate
      }
    #endif

    _ = cioAppDelegate.application(application, didFinishLaunchingWithOptions: launchOptions)

    MessagingPushAPN.initialize(
      withConfig: MessagingPushConfigBuilder()
        .autoFetchDeviceToken({{AUTO_FETCH_DEVICE_TOKEN}})
        .showPushAppInForeground({{SHOW_PUSH_APP_IN_FOREGROUND}})
        .autoTrackPushEvents({{AUTO_TRACK_PUSH_EVENTS}})
        .build()
    )
  }

  public func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    cioAppDelegate.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }
    
  public func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    cioAppDelegate.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }
}
