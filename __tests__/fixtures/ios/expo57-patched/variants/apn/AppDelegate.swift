internal import Expo
import React
import ReactAppDependencyProvider

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

private func cioLifecycleRouteResultFacts(
  _ facts: [String: Any],
  handled: Bool,
  result: String? = nil
) -> [String: Any] {
  var routed = facts
  var flags = routed["flags"] as? [String: Bool] ?? [:]
  flags["handled"] = handled
  routed["flags"] = flags
  var enums = routed["enums"] as? [String: String] ?? [:]
  enums["result"] = result ?? (handled ? "handled" : "unhandled")
  routed["enums"] = enums
  return routed
}

@main
class AppDelegate: ExpoAppDelegate {
  let cioSdkHandler = CioSdkAppDelegateHandler()

  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if cioLifecycleIsColdStartScenario() {
      cioLifecycleProbeRecord(
        "application.did-finish-launching",
        owner: "application-delegate",
        kind: "os-callback",
        phase: "entry",
        facts: [
          "flags": ["has_launch_options": launchOptions != nil],
          "counts": ["launch_option_keys": launchOptions?.count ?? 0],
          "enums": ["app_state": cioLifecycleAppState(application)]
        ]
      )
    }
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // Deep link workaround for app killed state start
    var modifiedLaunchOptions = launchOptions
    if let launchOptions = launchOptions,
       let pushContent = launchOptions[UIApplication.LaunchOptionsKey.remoteNotification] as? [AnyHashable: Any],
       let cio = pushContent["CIO"] as? [String: Any],
       let push = cio["push"] as? [String: Any],
       let link = push["link"] as? String,
       !launchOptions.keys.contains(UIApplication.LaunchOptionsKey.url) {
        
        var mutableLaunchOptions = launchOptions
        mutableLaunchOptions[UIApplication.LaunchOptionsKey.url] = URL(string: link)
        modifiedLaunchOptions = mutableLaunchOptions
    }
    // Deep link workaround for app killed state ends

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: modifiedLaunchOptions)
#endif

      cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)

    return super.application(application, didFinishLaunchingWithOptions: modifiedLaunchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    let lifecycleFacts = cioLifecycleURLFacts(url)
    cioLifecycleProbeRecord(
      "application.open-url",
      owner: "application-delegate",
      kind: "os-callback",
      phase: "entry",
      facts: lifecycleFacts
    )
    cioLifecycleProbeRecord(
      "host.route-url",
      owner: "host",
      kind: "host-routing",
      phase: "intent",
      facts: lifecycleFacts
    )
    let isLiveActivityURL = url.scheme == "cio-live-activity"
      && url.host == "open"
      && URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems != nil
    if isLiveActivityURL {
      cioLifecycleProbeRecord(
        "customerio.route-deep-link",
        owner: "customerio-sdk",
        kind: "sdk-routing",
        phase: "intent",
        facts: lifecycleFacts
      )
    }
    // Call CustomerIO SDK handler
    guard let routedURL = cioSdkHandler.application(app, open: url, options: options) else {
      if isLiveActivityURL {
        cioLifecycleProbeRecord(
          "customerio.route-deep-link",
          owner: "customerio-sdk",
          kind: "sdk-routing",
          phase: "result",
          facts: cioLifecycleRouteResultFacts(lifecycleFacts, handled: true)
        )
      }
      cioLifecycleProbeRecord(
        "host.route-url",
        owner: "host",
        kind: "host-routing",
        phase: "result",
        facts: cioLifecycleRouteResultFacts(lifecycleFacts, handled: true)
      )
      return true
    }
    let handled = super.application(app, open: routedURL, options: options)
      || RCTLinkingManager.application(app, open: routedURL, options: options)
    if isLiveActivityURL {
      cioLifecycleProbeRecord(
        "customerio.route-deep-link",
        owner: "customerio-sdk",
        kind: "sdk-routing",
        phase: "result",
        facts: cioLifecycleRouteResultFacts(lifecycleFacts, handled: true, result: "redirect")
      )
    }
    cioLifecycleProbeRecord(
      "host.route-url",
      owner: "host",
      kind: "host-routing",
      phase: "result",
      facts: cioLifecycleRouteResultFacts(lifecycleFacts, handled: handled)
    )
    return handled
  }

  // Universal Links
  public override func application(
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
      "application.continue-user-activity",
      owner: "application-delegate",
      kind: "os-callback",
      phase: "entry",
      facts: facts
    )
    cioLifecycleProbeRecord(
      "host.route-user-activity",
      owner: "host",
      kind: "host-routing",
      phase: "intent",
      facts: facts
    )
    let linkingResult = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    let handled = super.application(application, continue: userActivity, restorationHandler: restorationHandler) || linkingResult
    cioLifecycleProbeRecord(
      "host.route-user-activity",
      owner: "host",
      kind: "host-routing",
      phase: "result",
      facts: cioLifecycleRouteResultFacts(facts, handled: handled)
    )
    return handled
  }

  // Handle device token registration
  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    cioLifecycleProbeRecord(
      "application.did-register-for-remote-notifications",
      owner: "application-delegate",
      kind: "os-callback",
      phase: "entry",
      facts: [
        "flags": ["has_device_token": true],
        "counts": ["device_token_bytes": deviceToken.count]
      ]
    )
    // Call CustomerIO SDK handler
    cioSdkHandler.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  // Handle remote notification registration errors
  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    cioLifecycleProbeRecord(
      "application.did-fail-to-register-for-remote-notifications",
      owner: "application-delegate",
      kind: "os-callback",
      phase: "entry",
      facts: ["enums": ["error_class": "registration", "result": "failure"]]
    )
    // Call CustomerIO SDK handler
    cioSdkHandler.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
