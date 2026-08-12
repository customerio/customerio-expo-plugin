// Copyright 2018-present 650 Industries. All rights reserved.

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

@MainActor
@preconcurrency
@objc
public class AppDelegatesLoaderDelegate: NSObject {
  /**
   Gets and registers AppDelegate subscribers.
   */
  @objc
  public static func registerAppDelegateSubscribers(_ legacySubscriber: ExpoAppDelegateSubscriberProtocol) {
    let modulesProvider = AppContext.modulesProvider(withName: "ExpoModulesProvider")
    ExpoAppDelegateSubscriberRepository.registerSubscriber(legacySubscriber)
    ExpoAppDelegateSubscriberRepository.registerSubscribersFrom(modulesProvider: modulesProvider)
    ExpoAppDelegateSubscriberRepository.registerReactDelegateHandlersFrom(modulesProvider: modulesProvider)
    if cioLifecycleIsColdStartScenario() {
      cioLifecycleProbeRecord(
        "expo.subscriber-registered",
        owner: "expo-subscriber",
        phase: "result"
      )
    }
  }
}
