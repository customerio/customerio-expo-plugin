//  Copyright © 2024 650 Industries. All rights reserved.

import ExpoModulesCore
import Foundation
import UserNotifications

private let cioLifecycleProbeNotification = Notification.Name("io.customer.lifecycle-trace.probe.v1")

private func cioLifecycleIsColdStartScenario() -> Bool {
  guard let scenario = ProcessInfo.processInfo.environment["CIO_LIFECYCLE_SCENARIO"] else {
    return false
  }
  return [
    "icon-cold-launch",
    "push-tap-cold",
    "local-notification-tap-cold",
    "custom-url-cold",
    "universal-link-cold",
    "quick-action-cold",
    "live-activity-tap-cold"
  ].contains(scenario)
}

private func cioLifecycleProbeRecord(
  _ callback: String,
  owner: String,
  kind: String = "framework-callback",
  phase: String,
  facts: [String: Any] = [:]
) {
  guard let processInstanceID = ProcessInfo.processInfo.environment["CIO_LIFECYCLE_PROCESS_INSTANCE_ID"] else {
    return
  }
  var userInfo = facts
  userInfo["callback"] = callback
  userInfo["owner"] = owner
  userInfo["kind"] = kind
  userInfo["phase"] = phase
  userInfo["process_instance_id"] = processInstanceID
  let center = NotificationCenter.default
  center.post(
    name: cioLifecycleProbeNotification,
    object: center,
    userInfo: userInfo
  )
}

private func cioLifecycleNotificationFacts(
  _ notification: UNNotification,
  response: UNNotificationResponse? = nil
) -> [String: Any] {
  let userInfo = notification.request.content.userInfo
  var correlation: [String: String] = [
    "request": notification.request.identifier
  ]
  if let delivery = userInfo["CIO-Delivery-ID"] as? String {
    correlation["delivery"] = delivery
  }
  let isRemote = notification.request.trigger is UNPushNotificationTrigger
  let isCustomerIO = userInfo["CIO-Delivery-ID"] != nil && userInfo["CIO-Delivery-Token"] != nil
  var flags: [String: Bool] = [
    "has_notification": true,
    "has_notification_response": response != nil,
    "has_aps": userInfo["aps"] != nil,
    "has_delivery_id": userInfo["CIO-Delivery-ID"] != nil,
    "has_delivery_token": userInfo["CIO-Delivery-Token"] != nil
  ]
  var enums: [String: String] = [
    "notification_origin": isRemote ? "remote" : "local",
    "notification_class": isCustomerIO ? "customerio" : "non-customerio",
    "delegate_peer": "expo-notifications"
  ]
  if let response {
    switch response.actionIdentifier {
    case UNNotificationDefaultActionIdentifier:
      enums["action_class"] = "default"
    case UNNotificationDismissActionIdentifier:
      enums["action_class"] = "dismiss"
    default:
      enums["action_class"] = "custom"
    }
    flags["has_notification_response"] = true
  }
  return [
    "flags": flags,
    "counts": ["notification_user_info_keys": userInfo.count],
    "enums": enums,
    "raw_correlation": correlation
  ]
}

/**
 Protocol that NotificationCenterManager delegates may implement
 */
public protocol NotificationDelegate: AnyObject {
  func willPresent(_ notification: UNNotification, completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) -> Bool
  func didReceive(_ response: UNNotificationResponse, completionHandler: @escaping () -> Void) -> Bool
  func didReceive(_ userInfo: [AnyHashable: Any], completionHandler: @escaping (UIBackgroundFetchResult) -> Void) -> Bool
  func openSettings(_ notification: UNNotification?)
  func didRegister(_ deviceToken: String)
  func didFailRegistration(_ error: Error)
}

public extension NotificationDelegate {
  func willPresent(_ notification: UNNotification, completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) -> Bool {
    return false
  }
  func didReceive(_ response: UNNotificationResponse, completionHandler: @escaping () -> Void) -> Bool {
    return false
  }
  func didReceive(_ userInfo: [AnyHashable: Any], completionHandler: @escaping (UIBackgroundFetchResult) -> Void) -> Bool {
    // false is equivalent to not handled, we then call completionHandler(.noData) below
    return false
  }
  func openSettings(_ notification: UNNotification?) {}
  func didRegister(_ deviceToken: String) {}
  func didFailRegistration(_ error: Error) {}
}

/**
 Singleton that sets itself as the UserNotificationCenter delegate,
 and calls its own delegates in response to notification center calls.
 */
public class NotificationCenterManager: NSObject,
  UNUserNotificationCenterDelegate,
  NotificationDelegate {
  @objc
  public static let shared = NotificationCenterManager()

  var delegates: [NotificationDelegate] = []
  var pendingResponses: [UNNotificationResponse] = []
  let userNotificationCenter: UNUserNotificationCenter = UNUserNotificationCenter.current()

  private override init() {
    super.init()
    if UNUserNotificationCenter.current().delegate != nil {
      NSLog(
        "[expo-notifications] NotificationCenterManager encountered already present delegate of " +
        "UNUserNotificationCenter. NotificationCenterManager will not overwrite the value not to break other " +
        "features of your app. In return, expo-notifications may not work properly. To fix this problem either " +
        "remove setting of the second delegate, or set the delegate to an instance of NotificationCenterManager " +
        "manually afterwards."
      )
      return
    }
    UNUserNotificationCenter.current().delegate = self
  }

  public func addDelegate(_ delegate: NotificationDelegate) {
    delegates.append(delegate)
    var handled = false
    for pendingResponse in pendingResponses {
      handled = delegate.didReceive(pendingResponse, completionHandler: {}) || handled
    }
    if handled {
      pendingResponses.removeAll()
    }
  }

  public func removeDelegate(_ delegate: AnyObject) {
    if let index = delegates.firstIndex(where: { $0 === delegate }) {
      delegates.remove(at: index)
    }
  }

  // MARK: - Called by PushTokenAppDelegateSubscriber

  public func didFailRegistration(_ error: any Error) {
    for delegate in delegates {
      delegate.didFailRegistration(error)
    }
  }

  public func didRegister(_ deviceToken: String) {
    for delegate in delegates {
      delegate.didRegister(deviceToken)
    }
  }

  // MARK: - UNUserNotificationCenterDelegate

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    let lifecycleFacts = cioLifecycleNotificationFacts(notification)
    cioLifecycleProbeRecord(
      "expo.notification-center-manager.will-present-forwarded",
      owner: "expo-notifications",
      phase: "entry",
      facts: lifecycleFacts
    )
    var handled = false
    for delegate in delegates {
      handled = delegate.willPresent(notification, completionHandler: completionHandler) || handled
    }
    if !handled {
      completionHandler([])
    }
  }

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let lifecycleFacts = cioLifecycleNotificationFacts(response.notification, response: response)
    cioLifecycleProbeRecord(
      "expo.notification-center-manager.did-receive-response-forwarded",
      owner: "expo-notifications",
      phase: "entry",
      facts: lifecycleFacts
    )
    var handled = false
    for delegate in delegates {
      handled = delegate.didReceive(response, completionHandler: completionHandler) || handled
    }
    if !handled {
      pendingResponses.append(response)
    }
    completionHandler()
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {
    let lifecycleFacts: [String: Any] = notification.map { cioLifecycleNotificationFacts($0) } ?? [
      "flags": ["has_notification": false],
      "counts": ["notification_user_info_keys": 0],
      "enums": [
        "notification_origin": "none",
        "notification_class": "none",
        "delegate_peer": "expo-notifications"
      ]
    ]
    cioLifecycleProbeRecord(
      "notification-center.settings",
      owner: "notification-center-delegate",
      kind: "os-callback",
      phase: "entry",
      facts: lifecycleFacts
    )
    for delegate in delegates {
      delegate.openSettings(notification)
    }
  }

  // MARK: - Called from NotificationsAppDelegateSubscriber
  public func didReceive(_ userInfo: [AnyHashable: Any], completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    var handled = false
    for delegate in delegates {
      handled = delegate.didReceive(userInfo, completionHandler: completionHandler) || handled
    }
    if !handled {
      completionHandler(.noData)
    }
  }
}
