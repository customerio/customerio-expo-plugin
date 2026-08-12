//  Copyright © 2024 650 Industries. All rights reserved.

import ExpoModulesCore
import Foundation

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

private func cioLifecycleAppState(_ application: UIApplication) -> String {
  switch application.applicationState {
  case .active: return "active"
  case .inactive: return "inactive"
  case .background: return "background"
  @unknown default: return "unknown"
  }
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
import UIKit
import MachO

let onDidReceiveNotification = "onDidReceiveNotification"
let onDidReceiveNotificationResponse = "onDidReceiveNotificationResponse"
let onDidClearNotificationResponse = "onDidClearNotificationResponse"

open class EmitterModule: Module, NotificationDelegate {
  private var lastResponse: [String: Any]?
  private var lastResponseLifecycleFacts: [String: Any]?
  public func definition() -> ModuleDefinition {
    Name("ExpoNotificationsEmitter")

    Events([onDidReceiveNotification, onDidReceiveNotificationResponse, onDidClearNotificationResponse])

    OnCreate {
      NotificationCenterManager.shared.addDelegate(self)
      cioLifecycleProbeRecord(
        "expo.notifications-emitter-created",
        owner: "expo-notifications",
        phase: "result"
      )
    }

    OnDestroy {
      NotificationCenterManager.shared.removeDelegate(self)
    }

    Function("getLastNotificationResponse") { () -> [String: Any]? in
      if var facts = lastResponseLifecycleFacts {
        var enums = facts["enums"] as? [String: String] ?? [:]
        enums["app_state"] = cioLifecycleAppState(UIApplication.shared)
        facts["enums"] = enums
        cioLifecycleProbeRecord(
          "expo.last-notification-response-pulled",
          owner: "expo-framework",
          phase: "result",
          facts: facts
        )
      }
      return lastResponse
    }

    Function("clearLastNotificationResponse") {
      lastResponse = nil
      lastResponseLifecycleFacts = nil
    }
  }

  open func didReceive(_ response: UNNotificationResponse, completionHandler: @escaping () -> Void) -> Bool {
    let notificationResponse = serializedResponse(response)
    lastResponse = notificationResponse
    lastResponseLifecycleFacts = cioLifecycleNotificationFacts(response.notification, response: response)
    self.sendEvent(onDidReceiveNotificationResponse, notificationResponse)
    cioLifecycleProbeRecord(
      "expo.notifications-emitter.notification-response-event-sent",
      owner: "expo-notifications",
      phase: "result",
      facts: cioLifecycleNotificationFacts(response.notification, response: response)
    )
    completionHandler()
    return true
  }

  open func willPresent(_ notification: UNNotification, completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) -> Bool {
    self.sendEvent(onDidReceiveNotification, serializedNotification(notification).toDictionary(appContext: appContext))
    cioLifecycleProbeRecord(
      "expo.notifications-emitter.notification-received-event-sent",
      owner: "expo-notifications",
      phase: "result",
      facts: cioLifecycleNotificationFacts(notification)
    )
    return false
  }

  open func serializedNotification(_ notification: UNNotification) -> NotificationRecord {
    return NotificationRecord(from: notification)
  }

  open func serializedResponse(_ response: UNNotificationResponse) -> [String: Any] {
    return NotificationResponseRecord(from: response).toDictionary(appContext: appContext)
  }
}
