import Dispatch
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

private func cioLifecycleURLFacts(_ url: URL) -> [String: Any] {
  let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
  let scheme = components?.scheme?.lowercased()
  let urlScheme: String
  let urlClass: String
  switch scheme {
  case "https":
    urlScheme = "https"
    urlClass = "web"
  case "http":
    urlScheme = "http"
    urlClass = "web"
  case .some:
    urlScheme = "custom"
    urlClass = scheme == "cio-live-activity" ? "cio-live-activity" : "custom-scheme"
  case nil:
    urlScheme = "unknown"
    urlClass = "other"
  }
  let queryItems = components?.queryItems ?? []
  let deliveryID = queryItems.first { $0.name == "cio_delivery_id" }?.value
  let hasDeliveryToken = queryItems.contains {
    $0.name == "cio_delivery_token" && $0.value != nil
  }
  let hasRedirect = queryItems.contains {
    $0.name == "cio_redirect" && $0.value != nil
  }
  var correlation: [String: String] = ["url": url.absoluteString]
  if let deliveryID {
    correlation["delivery"] = deliveryID
  }
  return [
    "flags": [
      "has_url": true,
      "has_delivery_id": deliveryID != nil,
      "has_delivery_token": hasDeliveryToken,
      "has_redirect": hasRedirect
    ],
    "counts": [
      "url_path_components": url.pathComponents.filter { $0 != "/" }.count,
      "url_query_items": queryItems.count
    ],
    "enums": ["url_scheme": urlScheme, "url_class": urlClass],
    "raw_correlation": correlation
  ]
}

private func cioLifecycleRemoteNotificationFacts(
  _ userInfo: [AnyHashable: Any]
) -> [String: Any] {
  var correlation: [String: String] = [:]
  if let delivery = userInfo["CIO-Delivery-ID"] as? String {
    correlation["delivery"] = delivery
  }
  return [
    "flags": [
      "has_notification": true,
      "has_aps": userInfo["aps"] != nil,
      "has_delivery_id": userInfo["CIO-Delivery-ID"] != nil,
      "has_delivery_token": userInfo["CIO-Delivery-Token"] != nil
    ],
    "counts": ["notification_user_info_keys": userInfo.count],
    "enums": [
      "notification_origin": "remote",
      "notification_class": (userInfo["CIO-Delivery-ID"] != nil && userInfo["CIO-Delivery-Token"] != nil) ? "customerio" : "non-customerio",
      "delegate_peer": "expo-notifications"
    ],
    "raw_correlation": correlation
  ]
}

@MainActor
@preconcurrency
public class ExpoAppDelegateSubscriberManager: NSObject {
#if os(iOS) || os(tvOS)

  @objc
  public static func application(
    _ application: UIApplication,
    willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let parsedSubscribers = ExpoAppDelegateSubscriberRepository.subscribers.filter {
      $0.responds(to: #selector(UIApplicationDelegate.application(_:willFinishLaunchingWithOptions:)))
    }

    // If we can't find a subscriber that implements `willFinishLaunchingWithOptions`, we will delegate the decision if we can handle the passed URL to
    // the `didFinishLaunchingWithOptions` method by returning `true` here.
    //  You can read more about how iOS handles deep links here: https://developer.apple.com/documentation/uikit/uiapplicationdelegate/1623112-application#discussion
    if parsedSubscribers.isEmpty {
      return true
    }

    return parsedSubscribers.reduce(false) { result, subscriber in
      return subscriber.application?(application, willFinishLaunchingWithOptions: launchOptions) ?? false || result
    }
  }

  @objc
  public static func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    ExpoAppDelegateSubscriberRepository.subscribers.forEach { subscriber in
      // Subscriber result is ignored as it doesn't matter if any subscriber handled the incoming URL – we always return `true` anyway.
      _ = subscriber.application?(application, didFinishLaunchingWithOptions: launchOptions)
    }

    return true
  }

#elseif os(macOS)
  @objc
  public static func applicationWillFinishLaunching(_ notification: Notification) {
    let parsedSubscribers = ExpoAppDelegateSubscriberRepository.subscribers.filter {
      $0.responds(to: #selector(NSApplicationDelegate.applicationWillFinishLaunching(_:)))
    }

    parsedSubscribers.forEach { subscriber in
      subscriber.applicationWillFinishLaunching?(notification)
    }
  }

  @objc
  public static func applicationDidFinishLaunching(_ notification: Notification) {
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { subscriber in
        // Subscriber result is ignored as it doesn't matter if any subscriber handled the incoming URL – we always return `true` anyway.
        _ = subscriber.applicationDidFinishLaunching?(notification)
      }
  }

  // TODO: - Configuring and Discarding Scenes
#endif

  // MARK: - Responding to App Life-Cycle Events

#if os(iOS) || os(tvOS)

  @objc
  public static func applicationDidBecomeActive(_ application: UIApplication) {
    cioLifecycleProbeRecord(
      "expo.subscriber.did-become-active-forwarded",
      owner: "expo-subscriber",
      phase: "state-change",
      facts: ["enums": ["app_state": cioLifecycleAppState(application)]]
    )
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationDidBecomeActive?(application) }
  }

  @objc
  public static func applicationWillResignActive(_ application: UIApplication) {
    cioLifecycleProbeRecord(
      "expo.subscriber.will-resign-active-forwarded",
      owner: "expo-subscriber",
      phase: "state-change",
      facts: ["enums": ["app_state": cioLifecycleAppState(application)]]
    )
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationWillResignActive?(application) }
  }

  @objc
  public static func applicationDidEnterBackground(_ application: UIApplication) {
    cioLifecycleProbeRecord(
      "expo.subscriber.did-enter-background-forwarded",
      owner: "expo-subscriber",
      phase: "state-change",
      facts: ["enums": ["app_state": cioLifecycleAppState(application)]]
    )
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationDidEnterBackground?(application) }
  }

  @objc
  public static func applicationWillEnterForeground(_ application: UIApplication) {
    cioLifecycleProbeRecord(
      "expo.subscriber.will-enter-foreground-forwarded",
      owner: "expo-subscriber",
      phase: "state-change",
      facts: ["enums": ["app_state": cioLifecycleAppState(application)]]
    )
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationWillEnterForeground?(application) }
  }

  @objc
  public static func applicationWillTerminate(_ application: UIApplication) {
    cioLifecycleProbeRecord(
      "expo.subscriber.will-terminate-forwarded",
      owner: "expo-subscriber",
      phase: "state-change",
      facts: ["enums": ["app_state": cioLifecycleAppState(application)]]
    )
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationWillTerminate?(application) }
  }

#elseif os(macOS)
  @objc
  public static func applicationDidBecomeActive(_ notification: Notification) {
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationDidBecomeActive?(notification) }
  }

  @objc
  public static func applicationWillResignActive(_ notification: Notification) {
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationWillResignActive?(notification) }
  }

  @objc
  public static func applicationDidHide(_ notification: Notification) {
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationDidHide?(notification) }
  }

  @objc
  public static func applicationWillUnhide(_ notification: Notification) {
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationWillUnhide?(notification) }
  }

  @objc
  public static func applicationWillTerminate(_ notification: Notification) {
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationWillTerminate?(notification) }
  }
#endif

  // MARK: - Responding to Environment Changes

#if os(iOS) || os(tvOS)

  @objc
  public static func applicationDidReceiveMemoryWarning(_ application: UIApplication) {
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.applicationDidReceiveMemoryWarning?(application) }
  }

#endif

  // TODO: - Managing App State Restoration

  // MARK: - Downloading Data in the Background

#if os(iOS) || os(tvOS)
  @objc
  public static func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    let selector = #selector(UIApplicationDelegate.application(_:handleEventsForBackgroundURLSession:completionHandler:))
    let subs = ExpoAppDelegateSubscriberRepository.subscribers.filter { $0.responds(to: selector) }
    if subs.isEmpty {
      completionHandler()
      return
    }
    var subscribersLeft = subs.count

    let aggregatedHandler = {
      DispatchQueue.main.async {
        subscribersLeft -= 1

        if subscribersLeft == 0 {
          completionHandler()
        }
      }
    }

    subs.forEach {
      $0.application?(application, handleEventsForBackgroundURLSession: identifier, completionHandler: aggregatedHandler)
    }
  }

#endif

  // MARK: - Handling Remote Notification Registration

  @objc
  public static func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    cioLifecycleProbeRecord(
      "expo.subscriber.did-register-for-remote-notifications-forwarded",
      owner: "expo-subscriber",
      phase: "entry",
      facts: [
        "flags": ["has_device_token": true],
        "counts": ["device_token_bytes": deviceToken.count]
      ]
    )
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.application?(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken) }
  }

  @objc
  public static func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    cioLifecycleProbeRecord(
      "expo.subscriber.did-fail-to-register-for-remote-notifications-forwarded",
      owner: "expo-subscriber",
      phase: "entry",
      facts: ["enums": ["error_class": "registration", "result": "failure"]]
    )
    ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.application?(application, didFailToRegisterForRemoteNotificationsWithError: error) }
  }

#if os(iOS) || os(tvOS)
  @objc
  public static func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    cioLifecycleProbeRecord(
      "expo.subscriber.did-receive-remote-notification-forwarded",
      owner: "expo-subscriber",
      phase: "entry",
      facts: cioLifecycleRemoteNotificationFacts(userInfo)
    )
    let selector = #selector(UIApplicationDelegate.application(_:didReceiveRemoteNotification:fetchCompletionHandler:))
    let subs = ExpoAppDelegateSubscriberRepository.subscribers.filter { $0.responds(to: selector) }
    if subs.isEmpty {
      completionHandler(.noData)
      return
    }

    var subscribersLeft = subs.count
    var failedCount = 0
    var newDataCount = 0

    let aggregatedHandler = { (result: UIBackgroundFetchResult) in
      DispatchQueue.main.async {
        if result == .failed {
          failedCount += 1
        } else if result == .newData {
          newDataCount += 1
        }

        subscribersLeft -= 1

        if subscribersLeft == 0 {
          if newDataCount > 0 {
            completionHandler(.newData)
          } else if failedCount > 0 {
            completionHandler(.failed)
          } else {
            completionHandler(.noData)
          }
        }
      }
    }

    subs.forEach { subscriber in
      subscriber.application?(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: aggregatedHandler)
    }
  }

#elseif os(macOS)
  @objc
  public static func application(
    _ application: NSApplication,
    didReceiveRemoteNotification userInfo: [String: Any]
  ) {
    let selector = #selector(NSApplicationDelegate.application(_:didReceiveRemoteNotification:))
    let subs = ExpoAppDelegateSubscriberRepository.subscribers.filter { $0.responds(to: selector) }

    subs.forEach { subscriber in
      subscriber.application?(application, didReceiveRemoteNotification: userInfo)
    }
  }
#endif

  // MARK: - Continuing User Activity and Handling Quick Actions

  @objc
  public static func application(_ application: UIApplication, willContinueUserActivityWithType userActivityType: String) -> Bool {
    return ExpoAppDelegateSubscriberRepository
      .subscribers
      .reduce(false) { result, subscriber in
        return subscriber.application?(application, willContinueUserActivityWithType: userActivityType) ?? false || result
      }
  }

#if os(iOS) || os(tvOS)
  @objc
  public static func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    var facts: [String: Any] = [
      "flags": ["has_user_activity": true],
      "enums": [
        "activity_class": userActivity.activityType == NSUserActivityTypeBrowsingWeb ? "web-browsing" : "custom"
      ]
    ]
    if let url = userActivity.webpageURL {
      facts.merge(cioLifecycleURLFacts(url)) { _, new in new }
      var flags = facts["flags"] as? [String: Bool] ?? [:]
      flags["has_user_activity"] = true
      facts["flags"] = flags
    }
    cioLifecycleProbeRecord(
      "expo.subscriber.continue-user-activity-forwarded",
      owner: "expo-subscriber",
      phase: "entry",
      facts: facts
    )
    let selector = #selector(UIApplicationDelegate.application(_:continue:restorationHandler:))
    let subs = ExpoAppDelegateSubscriberRepository.subscribers.filter { $0.responds(to: selector) }
    var subscribersLeft = subs.count
    var allRestorableObjects = [UIUserActivityRestoring]()

    let aggregatedHandler = { (restorableObjects: [UIUserActivityRestoring]?) in
      DispatchQueue.main.async {
        if let restorableObjects = restorableObjects {
          allRestorableObjects.append(contentsOf: restorableObjects)
        }

        subscribersLeft -= 1

        if subscribersLeft == 0 {
          restorationHandler(allRestorableObjects)
        }
      }
    }

    return subs.reduce(false) { result, subscriber in
      return subscriber.application?(application, continue: userActivity, restorationHandler: aggregatedHandler) ?? false || result
    }
  }
#elseif os(macOS)
  @objc
  public static func application(
    _ application: NSApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([any NSUserActivityRestoring]) -> Void
  ) -> Bool {
    let selector = #selector(NSApplicationDelegate.application(_:continue:restorationHandler:))
    let subs = ExpoAppDelegateSubscriberRepository.subscribers.filter { $0.responds(to: selector) }
    var subscribersLeft = subs.count
    var allRestorableObjects = [NSUserActivityRestoring]()

    let aggregatedHandler = { (restorableObjects: [NSUserActivityRestoring]?) in
      DispatchQueue.main.async {
        if let restorableObjects = restorableObjects {
          allRestorableObjects.append(contentsOf: restorableObjects)
        }

        subscribersLeft -= 1

        if subscribersLeft == 0 {
          restorationHandler(allRestorableObjects)
        }
      }
    }

    return subs.reduce(false) { result, subscriber in
      return subscriber.application?(application, continue: userActivity, restorationHandler: aggregatedHandler) ?? false || result
    }
  }
#endif

  @objc
  public static func application(_ application: UIApplication, didUpdate userActivity: NSUserActivity) {
    return ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach { $0.application?(application, didUpdate: userActivity) }
  }

  @objc
  public static func application(_ application: UIApplication, didFailToContinueUserActivityWithType userActivityType: String, error: Error) {
    return ExpoAppDelegateSubscriberRepository
      .subscribers
      .forEach {
        $0.application?(application, didFailToContinueUserActivityWithType: userActivityType, error: error)
      }
  }

#if os(iOS)
  @objc
  public static func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    cioLifecycleProbeRecord(
      "expo.subscriber.perform-quick-action-forwarded",
      owner: "expo-subscriber",
      phase: "entry",
      facts: ["flags": ["has_shortcut": true]]
    )
    let selector = #selector(UIApplicationDelegate.application(_:performActionFor:completionHandler:))
    let subs = ExpoAppDelegateSubscriberRepository.subscribers.filter { $0.responds(to: selector) }
    var subscribersLeft = subs.count
    var result: Bool = false

    if subs.isEmpty {
      completionHandler(result)
      return
    }

    let aggregatedHandler = { (succeeded: Bool) in
      DispatchQueue.main.async {
        result = result || succeeded
        subscribersLeft -= 1

        if subscribersLeft == 0 {
          completionHandler(result)
        }
      }
    }

    subs.forEach { subscriber in
      subscriber.application?(application, performActionFor: shortcutItem, completionHandler: aggregatedHandler)
    }
  }
#endif

  // MARK: - Background Fetch

#if os(iOS) || os(tvOS)
  @objc
  public static func application(
    _ application: UIApplication,
    performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    cioLifecycleProbeRecord(
      "expo.subscriber.perform-background-fetch-forwarded",
      owner: "expo-subscriber",
      phase: "entry"
    )
    let selector = #selector(UIApplicationDelegate.application(_:performFetchWithCompletionHandler:))
    let subs = ExpoAppDelegateSubscriberRepository.subscribers.filter { $0.responds(to: selector) }
    var subscribersLeft = subs.count
    if subs.isEmpty {
      completionHandler(.noData)
      return
    }
    var failedCount = 0
    var newDataCount = 0

    let aggregatedHandler = { (result: UIBackgroundFetchResult) in
      DispatchQueue.main.async {
        if result == .failed {
          failedCount += 1
        } else if result == .newData {
          newDataCount += 1
        }

        subscribersLeft -= 1

        if subscribersLeft == 0 {
          if newDataCount > 0 {
            completionHandler(.newData)
          } else if failedCount > 0 {
            completionHandler(.failed)
          } else {
            completionHandler(.noData)
          }
        }
      }
    }

    subs.forEach { subscriber in
      subscriber.application?(application, performFetchWithCompletionHandler: aggregatedHandler)
    }
  }

#endif

  // MARK: - Opening a URL-Specified Resource
#if os(iOS) || os(tvOS)

  @objc
  public static func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    cioLifecycleProbeRecord(
      "expo.subscriber.open-url-forwarded",
      owner: "expo-subscriber",
      phase: "entry",
      facts: cioLifecycleURLFacts(url)
    )
    return ExpoAppDelegateSubscriberRepository.subscribers.reduce(false) { result, subscriber in
      return subscriber.application?(app, open: url, options: options) ?? false || result
    }
  }
#elseif os(macOS)
  @objc
  public static func application(_ app: NSApplication, open urls: [URL]) {
    ExpoAppDelegateSubscriberRepository.subscribers.forEach { subscriber in
      subscriber.application?(app, open: urls)
    }
  }
#endif

#if os(iOS)

  /**
   * Sets allowed orientations for the application. It will use the values from `Info.plist`as the orientation mask unless a subscriber requested
   * a different orientation.
   */
  @objc
  public static func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
    let infoPlistOrientations = allowedOrientations(for: UIDevice.current.userInterfaceIdiom)

    let parsedSubscribers = ExpoAppDelegateSubscriberRepository.subscribers.filter {
      $0.responds(to: #selector(UIApplicationDelegate.application(_:supportedInterfaceOrientationsFor:)))
    }

    // We want to create an intersection of all orientations set by subscribers.
    let subscribersMask: UIInterfaceOrientationMask = parsedSubscribers.reduce(.all) { result, subscriber in
      guard let requestedOrientation = subscriber.application?(application, supportedInterfaceOrientationsFor: window) else {
        return result
      }
      return requestedOrientation.intersection(result)
    }
    return parsedSubscribers.isEmpty ? infoPlistOrientations : subscribersMask
  }
#endif
}

#if os(iOS)
func allowedOrientations(
  for userInterfaceIdiom: UIUserInterfaceIdiom,
  infoDictionary: [String: Any]? = Bundle.main.infoDictionary
) -> UIInterfaceOrientationMask {
  // For now only iPad-specific orientations are supported. When the `~ipad` key is absent,
  // fall back to the universal `UISupportedInterfaceOrientations` key, matching how UIKit
  // resolves device-specific keys. We additionally fall back when `~ipad` is present but
  // resolves to no orientations, treating a malformed entry as if it were absent.
  if userInterfaceIdiom == .pad,
    let mask = orientationMask(forKey: "UISupportedInterfaceOrientations~ipad", in: infoDictionary),
    !mask.isEmpty {
    return mask
  }
  return orientationMask(forKey: "UISupportedInterfaceOrientations", in: infoDictionary) ?? []
}

private func orientationMask(forKey key: String, in infoDictionary: [String: Any]?) -> UIInterfaceOrientationMask? {
  guard let orientations = infoDictionary?[key] as? [String] else {
    return nil
  }

  var mask: UIInterfaceOrientationMask = []
  for orientation in orientations {
    switch orientation {
    case "UIInterfaceOrientationPortrait":
      mask.insert(.portrait)
    case "UIInterfaceOrientationLandscapeLeft":
      mask.insert(.landscapeLeft)
    case "UIInterfaceOrientationLandscapeRight":
      mask.insert(.landscapeRight)
    case "UIInterfaceOrientationPortraitUpsideDown":
      mask.insert(.portraitUpsideDown)
    default:
      break
    }
  }
  return mask
}
#endif // os(iOS)
