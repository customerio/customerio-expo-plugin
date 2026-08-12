const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { assertSafeContainedPath } = require('./lib');

// Fixture-only, fail-closed patches for the exact Expo 57 source snapshot.
// The patched files are under a generated, gitignored test app. No production
// plugin transform or published package source is changed.

const REPO_ROOT = path.resolve(__dirname, '../..');
const GENERATED_FIXTURE_ROOT = path.join(REPO_ROOT, 'ci-test-apps');
const LOCK_PATH = path.join(__dirname, 'expo57-source-patch.lock.json');
const PATCHED_SNAPSHOT_ROOT = path.join(
  REPO_ROOT,
  '__tests__/fixtures/ios/expo57-patched'
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function arg(name) {
  const value = process.argv.find((item) => item.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : undefined;
}

function resolveGeneratedFixture(appPathValue) {
  const requested = path.resolve(REPO_ROOT, appPathValue);
  const root = fs.realpathSync(GENERATED_FIXTURE_ROOT);
  const appPath = fs.realpathSync(requested);
  const relative = path.relative(root, appPath);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('Refusing to patch outside ci-test-apps');
  }
  return appPath;
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(`${label}: exact patch anchor is absent`);
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: exact patch anchor is ambiguous`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const baseHelper = `
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
`;

const appStateHelper = `
private func cioLifecycleAppState(_ application: UIApplication) -> String {
  switch application.applicationState {
  case .active: return "active"
  case .inactive: return "inactive"
  case .background: return "background"
  @unknown default: return "unknown"
  }
}
`;

const urlFactsHelper = `
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
`;

const routeResultHelper = `
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
`;

const remoteFactsHelper = `
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
`;

const unNotificationFactsHelper = `
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
`;

function patchLoader(source) {
  source = replaceOnce(
    source,
    'import ExpoModulesCore\n',
    `import ExpoModulesCore\nimport Foundation\n${baseHelper}`,
    'AppDelegatesLoaderDelegate imports'
  );
  source = replaceOnce(
    source,
    '    ExpoAppDelegateSubscriberRepository.registerReactDelegateHandlersFrom(modulesProvider: modulesProvider)\n',
    `    ExpoAppDelegateSubscriberRepository.registerReactDelegateHandlersFrom(modulesProvider: modulesProvider)\n    if cioLifecycleIsColdStartScenario() {\n      cioLifecycleProbeRecord(\n        "expo.subscriber-registered",\n        owner: "expo-subscriber",\n        phase: "result"\n      )\n    }\n`,
    'AppDelegatesLoaderDelegate registration'
  );
  return source;
}

function patchExpoAppDelegate(source) {
  source = replaceOnce(
    source,
    'import ExpoModulesCore\n',
    `import ExpoModulesCore\n${baseHelper}${appStateHelper}`,
    'ExpoAppDelegate imports'
  );
  source = replaceOnce(
    source,
    '  ) -> Bool {\n    return ExpoAppDelegateSubscriberManager.application(application, willFinishLaunchingWithOptions: launchOptions)\n  }',
    `  ) -> Bool {\n    if cioLifecycleIsColdStartScenario() {\n      cioLifecycleProbeRecord(\n        "expo.app-delegate-will-finish-launching-forwarded",\n        owner: "expo-framework",\n        phase: "entry",\n        facts: [\n          "flags": ["has_launch_options": launchOptions != nil],\n          "counts": ["launch_option_keys": launchOptions?.count ?? 0]\n        ]\n      )\n    }\n    return ExpoAppDelegateSubscriberManager.application(application, willFinishLaunchingWithOptions: launchOptions)\n  }`,
    'ExpoAppDelegate willFinish'
  );
  source = replaceOnce(
    source,
    '  ) -> Bool {\n    return ExpoAppDelegateSubscriberManager.application(application, didFinishLaunchingWithOptions: launchOptions)\n  }',
    `  ) -> Bool {\n    if cioLifecycleIsColdStartScenario() {\n      cioLifecycleProbeRecord(\n        "expo.app-delegate-did-finish-launching-forwarded",\n        owner: "expo-framework",\n        phase: "entry",\n        facts: [\n          "flags": ["has_launch_options": launchOptions != nil],\n          "counts": ["launch_option_keys": launchOptions?.count ?? 0],\n          "enums": ["app_state": cioLifecycleAppState(application)]\n        ]\n      )\n    }\n    return ExpoAppDelegateSubscriberManager.application(application, didFinishLaunchingWithOptions: launchOptions)\n  }`,
    'ExpoAppDelegate didFinish'
  );
  const lifecycleSeats = [
    [
      '  open func applicationDidBecomeActive(_ application: UIApplication) {\n',
      'application.did-become-active',
    ],
    [
      '  open func applicationWillResignActive(_ application: UIApplication) {\n',
      'application.will-resign-active',
    ],
    [
      '  open func applicationDidEnterBackground(_ application: UIApplication) {\n',
      'application.did-enter-background',
    ],
    [
      '  open func applicationWillEnterForeground(_ application: UIApplication) {\n',
      'application.will-enter-foreground',
    ],
  ];
  for (const [signature, callback] of lifecycleSeats) {
    source = replaceOnce(
      source,
      signature,
      `${signature}    cioLifecycleProbeRecord(\n      "${callback}",\n      owner: "application-delegate",\n      kind: "os-callback",\n      phase: "state-change",\n      facts: ["enums": ["app_state": cioLifecycleAppState(application)]]\n    )\n`,
      `ExpoAppDelegate ${callback}`
    );
  }
  return source;
}

function patchSubscriberManager(source) {
  source = replaceOnce(
    source,
    'import Foundation\n',
    `import Foundation\n${baseHelper}${appStateHelper}${urlFactsHelper}${remoteFactsHelper}`,
    'SubscriberManager imports'
  );
  const simpleSeats = [
    [
      'public static func applicationDidBecomeActive(_ application: UIApplication) {',
      'expo.subscriber.did-become-active-forwarded',
      'state-change',
    ],
    [
      'public static func applicationWillResignActive(_ application: UIApplication) {',
      'expo.subscriber.will-resign-active-forwarded',
      'state-change',
    ],
    [
      'public static func applicationDidEnterBackground(_ application: UIApplication) {',
      'expo.subscriber.did-enter-background-forwarded',
      'state-change',
    ],
    [
      'public static func applicationWillEnterForeground(_ application: UIApplication) {',
      'expo.subscriber.will-enter-foreground-forwarded',
      'state-change',
    ],
    [
      'public static func applicationWillTerminate(_ application: UIApplication) {',
      'expo.subscriber.will-terminate-forwarded',
      'state-change',
    ],
  ];
  for (const [signature, callback, phase] of simpleSeats) {
    source = replaceOnce(
      source,
      `  ${signature}\n`,
      `  ${signature}\n    cioLifecycleProbeRecord(\n      "${callback}",\n      owner: "expo-subscriber",\n      phase: "${phase}",\n      facts: ["enums": ["app_state": cioLifecycleAppState(application)]]\n    )\n`,
      callback
    );
  }
  source = replaceOnce(
    source,
    '  public static func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n',
    `  public static func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n    cioLifecycleProbeRecord(\n      "expo.subscriber.did-register-for-remote-notifications-forwarded",\n      owner: "expo-subscriber",\n      phase: "entry",\n      facts: [\n        "flags": ["has_device_token": true],\n        "counts": ["device_token_bytes": deviceToken.count]\n      ]\n    )\n`,
    'SubscriberManager device token'
  );
  source = replaceOnce(
    source,
    '  public static func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {\n',
    `  public static func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {\n    cioLifecycleProbeRecord(\n      "expo.subscriber.did-fail-to-register-for-remote-notifications-forwarded",\n      owner: "expo-subscriber",\n      phase: "entry",\n      facts: ["enums": ["error_class": "registration", "result": "failure"]]\n    )\n`,
    'SubscriberManager registration failure'
  );
  source = replaceOnce(
    source,
    '  ) {\n    let selector = #selector(UIApplicationDelegate.application(_:didReceiveRemoteNotification:fetchCompletionHandler:))',
    `  ) {\n    cioLifecycleProbeRecord(\n      "expo.subscriber.did-receive-remote-notification-forwarded",\n      owner: "expo-subscriber",\n      phase: "entry",\n      facts: cioLifecycleRemoteNotificationFacts(userInfo)\n    )\n    let selector = #selector(UIApplicationDelegate.application(_:didReceiveRemoteNotification:fetchCompletionHandler:))`,
    'SubscriberManager remote notification'
  );
  source = replaceOnce(
    source,
    '  ) -> Bool {\n    let selector = #selector(UIApplicationDelegate.application(_:continue:restorationHandler:))',
    `  ) -> Bool {\n    var facts: [String: Any] = [\n      "flags": ["has_user_activity": true],\n      "enums": [\n        "activity_class": userActivity.activityType == NSUserActivityTypeBrowsingWeb ? "web-browsing" : "custom"\n      ]\n    ]\n    if let url = userActivity.webpageURL {\n      facts.merge(cioLifecycleURLFacts(url)) { _, new in new }\n      var flags = facts["flags"] as? [String: Bool] ?? [:]\n      flags["has_user_activity"] = true\n      facts["flags"] = flags\n    }\n    cioLifecycleProbeRecord(\n      "expo.subscriber.continue-user-activity-forwarded",\n      owner: "expo-subscriber",\n      phase: "entry",\n      facts: facts\n    )\n    let selector = #selector(UIApplicationDelegate.application(_:continue:restorationHandler:))`,
    'SubscriberManager user activity'
  );
  source = replaceOnce(
    source,
    '  public static func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {\n    return ExpoAppDelegateSubscriberRepository.subscribers.reduce(false) { result, subscriber in\n      return subscriber.application?(app, open: url, options: options) ?? false || result\n    }\n  }',
    `  public static func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {\n    cioLifecycleProbeRecord(\n      "expo.subscriber.open-url-forwarded",\n      owner: "expo-subscriber",\n      phase: "entry",\n      facts: cioLifecycleURLFacts(url)\n    )\n    return ExpoAppDelegateSubscriberRepository.subscribers.reduce(false) { result, subscriber in\n      return subscriber.application?(app, open: url, options: options) ?? false || result\n    }\n  }`,
    'SubscriberManager open URL'
  );
  source = replaceOnce(
    source,
    '  ) {\n    let selector = #selector(UIApplicationDelegate.application(_:performActionFor:completionHandler:))',
    `  ) {\n    cioLifecycleProbeRecord(\n      "expo.subscriber.perform-quick-action-forwarded",\n      owner: "expo-subscriber",\n      phase: "entry",\n      facts: ["flags": ["has_shortcut": true]]\n    )\n    let selector = #selector(UIApplicationDelegate.application(_:performActionFor:completionHandler:))`,
    'SubscriberManager quick action'
  );
  source = replaceOnce(
    source,
    '  ) {\n    let selector = #selector(UIApplicationDelegate.application(_:performFetchWithCompletionHandler:))',
    `  ) {\n    cioLifecycleProbeRecord(\n      "expo.subscriber.perform-background-fetch-forwarded",\n      owner: "expo-subscriber",\n      phase: "entry"\n    )\n    let selector = #selector(UIApplicationDelegate.application(_:performFetchWithCompletionHandler:))`,
    'SubscriberManager background fetch'
  );
  return source;
}

function patchNotificationCenterManager(source) {
  source = replaceOnce(
    source,
    'import UserNotifications\n',
    `import UserNotifications\n${baseHelper}${unNotificationFactsHelper}`,
    'NotificationCenterManager imports'
  );
  source = replaceOnce(
    source,
    '  ) {\n    var handled = false\n    for delegate in delegates {\n      handled = delegate.willPresent(notification, completionHandler: completionHandler) || handled',
    `  ) {\n    let lifecycleFacts = cioLifecycleNotificationFacts(notification)\n    cioLifecycleProbeRecord(\n      "expo.notification-center-manager.will-present-forwarded",\n      owner: "expo-notifications",\n      phase: "entry",\n      facts: lifecycleFacts\n    )\n    var handled = false\n    for delegate in delegates {\n      handled = delegate.willPresent(notification, completionHandler: completionHandler) || handled`,
    'NotificationCenterManager willPresent'
  );
  source = replaceOnce(
    source,
    '  ) {\n    var handled = false\n    for delegate in delegates {\n      handled = delegate.didReceive(response, completionHandler: completionHandler) || handled',
    `  ) {\n    let lifecycleFacts = cioLifecycleNotificationFacts(response.notification, response: response)\n    cioLifecycleProbeRecord(\n      "expo.notification-center-manager.did-receive-response-forwarded",\n      owner: "expo-notifications",\n      phase: "entry",\n      facts: lifecycleFacts\n    )\n    var handled = false\n    for delegate in delegates {\n      handled = delegate.didReceive(response, completionHandler: completionHandler) || handled`,
    'NotificationCenterManager didReceive response'
  );
  return replaceOnce(
    source,
    '  public func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {\n    for delegate in delegates {',
    `  public func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {
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
    for delegate in delegates {`,
    'NotificationCenterManager open settings'
  );
}

function patchEmitter(source) {
  source = replaceOnce(
    source,
    'import ExpoModulesCore\n',
    `import ExpoModulesCore\nimport Foundation\n${baseHelper}${appStateHelper}${unNotificationFactsHelper}`,
    'Emitter imports'
  );
  source = replaceOnce(
    source,
    '  private var lastResponse: [String: Any]?\n',
    '  private var lastResponse: [String: Any]?\n  private var lastResponseLifecycleFacts: [String: Any]?\n',
    'Emitter safe last response storage'
  );
  source = replaceOnce(
    source,
    '    OnCreate {\n      NotificationCenterManager.shared.addDelegate(self)\n    }',
    `    OnCreate {\n      NotificationCenterManager.shared.addDelegate(self)\n      cioLifecycleProbeRecord(\n        "expo.notifications-emitter-created",\n        owner: "expo-notifications",\n        phase: "result"\n      )\n    }`,
    'Emitter OnCreate'
  );
  source = replaceOnce(
    source,
    '    Function("getLastNotificationResponse") { () -> [String: Any]? in\n      return lastResponse\n    }',
    `    Function("getLastNotificationResponse") { () -> [String: Any]? in\n      if var facts = lastResponseLifecycleFacts {\n        var enums = facts["enums"] as? [String: String] ?? [:]\n        enums["app_state"] = cioLifecycleAppState(UIApplication.shared)\n        facts["enums"] = enums\n        cioLifecycleProbeRecord(\n          "expo.last-notification-response-pulled",\n          owner: "expo-framework",\n          phase: "result",\n          facts: facts\n        )\n      }\n      return lastResponse\n    }`,
    'Emitter last response pull'
  );
  source = replaceOnce(
    source,
    '    Function("clearLastNotificationResponse") {\n      lastResponse = nil\n    }',
    '    Function("clearLastNotificationResponse") {\n      lastResponse = nil\n      lastResponseLifecycleFacts = nil\n    }',
    'Emitter clear last response'
  );
  source = replaceOnce(
    source,
    '    lastResponse = notificationResponse\n    self.sendEvent(onDidReceiveNotificationResponse, notificationResponse)',
    '    lastResponse = notificationResponse\n    lastResponseLifecycleFacts = cioLifecycleNotificationFacts(response.notification, response: response)\n    self.sendEvent(onDidReceiveNotificationResponse, notificationResponse)',
    'Emitter capture safe last response facts'
  );
  source = replaceOnce(
    source,
    '    self.sendEvent(onDidReceiveNotificationResponse, notificationResponse)\n    completionHandler()',
    `    self.sendEvent(onDidReceiveNotificationResponse, notificationResponse)\n    cioLifecycleProbeRecord(\n      "expo.notifications-emitter.notification-response-event-sent",\n      owner: "expo-notifications",\n      phase: "result",\n      facts: cioLifecycleNotificationFacts(response.notification, response: response)\n    )\n    completionHandler()`,
    'Emitter response event'
  );
  return replaceOnce(
    source,
    '    self.sendEvent(onDidReceiveNotification, serializedNotification(notification).toDictionary(appContext: appContext))\n    return false',
    `    self.sendEvent(onDidReceiveNotification, serializedNotification(notification).toDictionary(appContext: appContext))\n    cioLifecycleProbeRecord(\n      "expo.notifications-emitter.notification-received-event-sent",\n      owner: "expo-notifications",\n      phase: "result",\n      facts: cioLifecycleNotificationFacts(notification)\n    )\n    return false`,
    'Emitter notification event'
  );
}

function patchGeneratedAppDelegate(source) {
  source = replaceOnce(
    source,
    'import ReactAppDependencyProvider\n',
    `import ReactAppDependencyProvider\n${baseHelper}${appStateHelper}${urlFactsHelper}${routeResultHelper}`,
    'generated AppDelegate imports'
  );
  source = replaceOnce(
    source,
    '  ) -> Bool {\n    let delegate = ReactNativeDelegate()',
    `  ) -> Bool {\n    if cioLifecycleIsColdStartScenario() {\n      cioLifecycleProbeRecord(\n        "application.did-finish-launching",\n        owner: "application-delegate",\n        kind: "os-callback",\n        phase: "entry",\n        facts: [\n          "flags": ["has_launch_options": launchOptions != nil],\n          "counts": ["launch_option_keys": launchOptions?.count ?? 0],\n          "enums": ["app_state": cioLifecycleAppState(application)]\n        ]\n      )\n    }\n    let delegate = ReactNativeDelegate()`,
    'generated AppDelegate didFinish'
  );
  const cioOpenAnchor =
    '  ) -> Bool {\n    // Call CustomerIO SDK handler\n    guard let url = cioSdkHandler.application(app, open: url, options: options) else { return true }';
  const plainOpenAnchor =
    '  ) -> Bool {\n    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)';
  if (source.includes(cioOpenAnchor)) {
    source = replaceOnce(
      source,
      `${cioOpenAnchor}\n\n    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)`,
      `  ) -> Bool {
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
    return handled`,
      'generated AppDelegate CIO open URL'
    );
  } else {
    source = replaceOnce(
      source,
      plainOpenAnchor,
      `  ) -> Bool {
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
    let handled = super.application(app, open: url, options: options)
      || RCTLinkingManager.application(app, open: url, options: options)
    cioLifecycleProbeRecord(
      "host.route-url",
      owner: "host",
      kind: "host-routing",
      phase: "result",
      facts: cioLifecycleRouteResultFacts(lifecycleFacts, handled: handled)
    )
    return handled`,
      'generated AppDelegate plain open URL'
    );
  }
  source = replaceOnce(
    source,
    '  ) -> Bool {\n    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)\n    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result',
    `  ) -> Bool {\n    var facts: [String: Any] = [\n      "flags": ["has_user_activity": true],\n      "enums": [\n        "activity_class": userActivity.activityType == NSUserActivityTypeBrowsingWeb ? "web-browsing" : "custom"\n      ]\n    ]\n    if let url = userActivity.webpageURL {\n      facts.merge(cioLifecycleURLFacts(url)) { _, new in new }\n      var flags = facts["flags"] as? [String: Bool] ?? [:]\n      flags["has_user_activity"] = true\n      facts["flags"] = flags\n    }\n    cioLifecycleProbeRecord(\n      "application.continue-user-activity",\n      owner: "application-delegate",\n      kind: "os-callback",\n      phase: "entry",\n      facts: facts\n    )\n    cioLifecycleProbeRecord(\n      "host.route-user-activity",\n      owner: "host",\n      kind: "host-routing",\n      phase: "intent",\n      facts: facts\n    )\n    let linkingResult = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)\n    let handled = super.application(application, continue: userActivity, restorationHandler: restorationHandler) || linkingResult\n    cioLifecycleProbeRecord(\n      "host.route-user-activity",\n      owner: "host",\n      kind: "host-routing",\n      phase: "result",\n      facts: cioLifecycleRouteResultFacts(facts, handled: handled)\n    )\n    return handled`,
    'generated AppDelegate user activity'
  );
  const tokenAnchor =
    '  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n';
  if (source.includes(tokenAnchor)) {
    source = replaceOnce(
      source,
      tokenAnchor,
      `  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n    cioLifecycleProbeRecord(\n      "application.did-register-for-remote-notifications",\n      owner: "application-delegate",\n      kind: "os-callback",\n      phase: "entry",\n      facts: [\n        "flags": ["has_device_token": true],\n        "counts": ["device_token_bytes": deviceToken.count]\n      ]\n    )\n`,
      'generated AppDelegate device token'
    );
    source = replaceOnce(
      source,
      '  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {\n',
      `  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {\n    cioLifecycleProbeRecord(\n      "application.did-fail-to-register-for-remote-notifications",\n      owner: "application-delegate",\n      kind: "os-callback",\n      phase: "entry",\n      facts: ["enums": ["error_class": "registration", "result": "failure"]]\n    )\n`,
      'generated AppDelegate registration failure'
    );
  }
  return source;
}

function patchGeneratedIndex(source) {
  source = replaceOnce(
    source,
    "import * as Device from 'expo-device';\n",
    "import * as Device from 'expo-device';\nimport { useEffect } from 'react';\n",
    'generated index React hook import'
  );
  source = replaceOnce(
    source,
    "import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';\n",
    "import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';\nimport { installLifecycleReceipts } from '@/lifecycle/LifecycleReceipts';\n",
    'generated index lifecycle import'
  );
  return replaceOnce(
    source,
    'export default function HomeScreen() {\n  return (',
    'export default function HomeScreen() {\n  useEffect(() => installLifecycleReceipts(), []);\n\n  return (',
    'generated index lifecycle install'
  );
}

function patchPodfileProperties(source) {
  let properties;
  try {
    properties = JSON.parse(source);
  } catch {
    throw new Error('Podfile.properties.json: expected valid JSON');
  }
  if (
    properties == null ||
    Array.isArray(properties) ||
    typeof properties !== 'object' ||
    properties.EXPO_USE_PRECOMPILED_MODULES !== 'true'
  ) {
    throw new Error(
      'Podfile.properties.json: expected EXPO_USE_PRECOMPILED_MODULES=true'
    );
  }
  properties.EXPO_USE_PRECOMPILED_MODULES = 'false';
  return `${JSON.stringify(properties, null, 2)}\n`;
}

const transforms = {
  appDelegatesLoaderDelegate: {
    relativePath:
      'node_modules/expo/ios/AppDelegates/AppDelegatesLoaderDelegate.swift',
    patch: patchLoader,
  },
  expoAppDelegate: {
    relativePath: 'node_modules/expo/ios/AppDelegates/ExpoAppDelegate.swift',
    patch: patchExpoAppDelegate,
  },
  subscriberManager: {
    relativePath:
      'node_modules/expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriberManager.swift',
    patch: patchSubscriberManager,
  },
  notificationCenterManager: {
    relativePath:
      'node_modules/expo-notifications/ios/ExpoNotifications/Notifications/NotificationCenterManager.swift',
    patch: patchNotificationCenterManager,
  },
  emitterModule: {
    relativePath:
      'node_modules/expo-notifications/ios/ExpoNotifications/Notifications/Emitter/EmitterModule.swift',
    patch: patchEmitter,
  },
  generatedAppDelegate: {
    relativePath: 'ios/LifecycleFixtureExpo57/AppDelegate.swift',
    patch: patchGeneratedAppDelegate,
  },
  generatedIndex: {
    relativePath: 'src/app/index.tsx',
    patch: patchGeneratedIndex,
  },
  podfileProperties: {
    relativePath: 'ios/Podfile.properties.json',
    patch: patchPodfileProperties,
  },
};

function main() {
  const appPathValue = arg('--app-path');
  if (!appPathValue) {
    throw new Error('Missing --app-path=<generated Expo 57 fixture>');
  }
  assertSafeContainedPath(REPO_ROOT, GENERATED_FIXTURE_ROOT, {
    label: 'generated fixture root',
  });
  assertSafeContainedPath(REPO_ROOT, PATCHED_SNAPSHOT_ROOT, {
    label: 'patched snapshot root',
  });
  assertSafeContainedPath(REPO_ROOT, LOCK_PATH, {
    label: 'fixture patch lock',
  });
  const appPath = resolveGeneratedFixture(appPathValue);
  const snapshotVariant = arg('--snapshot');
  if (snapshotVariant && !['apn', 'fcm', 'nopush'].includes(snapshotVariant)) {
    throw new Error('--snapshot must be apn, fcm, or nopush');
  }
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  if (lock.expoVersion !== '57.0.12') {
    throw new Error(`Unsupported patch lock Expo version: ${lock.expoVersion}`);
  }
  for (const [name, transform] of Object.entries(transforms)) {
    const filePath = assertSafeContainedPath(
      appPath,
      path.join(appPath, transform.relativePath),
      { label: `${name} generated source` }
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const beforeHash = sha256(source);
    const entry = lock.files[name];
    if (!entry || entry.path !== transform.relativePath) {
      throw new Error(`${name}: missing or mismatched lock entry`);
    }
    if (entry.postSha256.includes(beforeHash)) {
      process.stdout.write(`already patched ${transform.relativePath}\n`);
      continue;
    }
    if (!entry.preSha256.includes(beforeHash)) {
      throw new Error(`${name}: refused unexpected source hash ${beforeHash}`);
    }
    const patched = transform.patch(source);
    const afterHash = sha256(patched);
    if (!entry.postSha256.includes(afterHash)) {
      throw new Error(`${name}: patched hash ${afterHash} is not locked`);
    }
    assertSafeContainedPath(appPath, filePath, {
      label: `${name} generated source`,
    });
    fs.writeFileSync(filePath, patched);
    process.stdout.write(`patched ${transform.relativePath}\n`);
  }
  if (snapshotVariant) {
    const provenancePath = assertSafeContainedPath(
      PATCHED_SNAPSHOT_ROOT,
      path.join(PATCHED_SNAPSHOT_ROOT, 'PROVENANCE.json'),
      { allowMissing: true, label: 'patched snapshot provenance' }
    );
    const provenance = fs.existsSync(provenancePath)
      ? JSON.parse(fs.readFileSync(provenancePath, 'utf8'))
      : {
          schema: 'cio-expo57-patched-source-snapshot/1',
          patchLock: path.relative(REPO_ROOT, LOCK_PATH),
          files: {},
        };
    for (const [name, transform] of Object.entries(transforms)) {
      const sourcePath = assertSafeContainedPath(
        appPath,
        path.join(appPath, transform.relativePath),
        { label: `${name} generated source` }
      );
      const bytes = fs.readFileSync(sourcePath);
      const digest = sha256(bytes);
      const entry = lock.files[name];
      if (!entry.postSha256.includes(digest)) {
        throw new Error(`${name}: refusing to snapshot non-post-patch bytes`);
      }
      const snapshotRelative =
        name === 'generatedAppDelegate'
          ? `variants/${snapshotVariant}/AppDelegate.swift`
          : name === 'generatedIndex'
          ? 'javascript/src/app/index.tsx'
          : name === 'podfileProperties'
          ? `variants/${snapshotVariant}/Podfile.properties.json`
          : `framework/${transform.relativePath.replace(
              /^node_modules\//,
              ''
            )}`;
      const destination = path.join(PATCHED_SNAPSHOT_ROOT, snapshotRelative);
      assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, destination, {
        allowMissing: true,
        label: `${name} patched snapshot`,
      });
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, destination, {
        allowMissing: true,
        label: `${name} patched snapshot`,
      });
      fs.writeFileSync(destination, bytes);
      provenance.files[snapshotRelative] = { sha256: digest };
    }
    const appJsonPath = assertSafeContainedPath(
      appPath,
      path.join(appPath, 'app.json'),
      { label: 'generated app.json' }
    );
    const appJsonBytes = fs.readFileSync(appJsonPath);
    const appJsonRelative = `variants/${snapshotVariant}/app.json`;
    const appJsonDestination = path.join(
      PATCHED_SNAPSHOT_ROOT,
      appJsonRelative
    );
    assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, appJsonDestination, {
      allowMissing: true,
      label: 'patched app.json snapshot',
    });
    fs.mkdirSync(path.dirname(appJsonDestination), { recursive: true });
    assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, appJsonDestination, {
      allowMissing: true,
      label: 'patched app.json snapshot',
    });
    fs.writeFileSync(appJsonDestination, appJsonBytes);
    provenance.files[appJsonRelative] = { sha256: sha256(appJsonBytes) };
    const handlerPath = path.join(
      appPath,
      'ios/LifecycleFixtureExpo57/CioSdkAppDelegateHandler.swift'
    );
    if (fs.existsSync(handlerPath)) {
      assertSafeContainedPath(appPath, handlerPath, {
        label: 'generated Customer.io handler',
      });
      const handlerBytes = fs.readFileSync(handlerPath);
      const handlerRelative = `variants/${snapshotVariant}/CioSdkAppDelegateHandler.swift`;
      const handlerDestination = path.join(
        PATCHED_SNAPSHOT_ROOT,
        handlerRelative
      );
      assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, handlerDestination, {
        allowMissing: true,
        label: 'patched Customer.io handler snapshot',
      });
      fs.mkdirSync(path.dirname(handlerDestination), { recursive: true });
      assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, handlerDestination, {
        allowMissing: true,
        label: 'patched Customer.io handler snapshot',
      });
      fs.writeFileSync(handlerDestination, handlerBytes);
      provenance.files[handlerRelative] = { sha256: sha256(handlerBytes) };
    }
    assertSafeContainedPath(PATCHED_SNAPSHOT_ROOT, provenancePath, {
      allowMissing: true,
      label: 'patched snapshot provenance',
    });
    fs.writeFileSync(
      provenancePath,
      `${JSON.stringify(provenance, null, 2)}\n`
    );
  }
}

if (require.main === module) {
  main();
}

module.exports = { transforms, sha256 };
