import Foundation

enum LifecycleTraceExpoSupport {
    static func isColdStart(_ scenario: LifecycleTraceScenario) -> Bool {
        switch scenario {
        case .iconColdLaunch,
             .pushTapCold,
             .localNotificationTapCold,
             .customURLCold,
             .universalLinkCold,
             .quickActionCold,
             .liveActivityTapCold:
            return true
        default:
            return false
        }
    }

    static func supports(_ scenario: LifecycleTraceScenario) -> Bool {
        switch scenario {
        case .iconColdLaunch,
             .pushTapWarm,
             .pushTapCold,
             .localNotificationTapWarm,
             .localNotificationTapCold,
             .customURLWarm,
             .customURLCold,
             .universalLinkWarm,
             .universalLinkCold,
             .liveActivityTapWarm,
             .liveActivityTapCold,
             .tokenRegistration,
             .registrationFailure,
             .appBackgroundForeground:
            return true
        default:
            // Foreground presentation and background fetch require completion outcomes,
            // settings has no terminal route, and the Expo fixture has no quick-action seat.
            return false
        }
    }
}

private final class LifecycleTraceExpoProbeState: @unchecked Sendable {
    private let lock = NSLock()
    private var observed: Set<LifecycleTraceCallback> = []
    private var registrationRequest: String?
    private var closeScheduled = false

    func correlations(
        for callback: LifecycleTraceCallback,
        supplied: [LifecycleTraceAliasNamespace: LifecycleTraceCorrelationValue]
    ) -> [LifecycleTraceAliasNamespace: LifecycleTraceCorrelationValue] {
        lock.lock()
        defer { lock.unlock() }
        observed.insert(callback)
        if callback == .applicationDidRegisterForRemoteNotifications {
            registrationRequest = UUID().uuidString.lowercased()
        }
        var correlations = supplied
        if isRegistrationCallback(callback), let registrationRequest {
            correlations[.request] = .string(registrationRequest)
        }
        return correlations
    }

    func canClose(
        scenario: LifecycleTraceScenario,
        provider: LifecycleTraceProvider,
        after callback: LifecycleTraceCallback,
        phase: LifecycleTracePhase
    ) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !closeScheduled else { return false }
        let shouldClose: Bool
        switch scenario {
        case .iconColdLaunch:
            shouldClose = observed.contains(.expoSubscriberDidBecomeActiveForwarded)
                && (
                    observed.contains(.rctJavaScriptDidLoadNotification)
                        || observed.contains(.rctInstanceDidLoadBundleNotification)
                )
        case .pushTapWarm:
            shouldClose = callback == .expoNotificationsEmitterNotificationResponseEventSent
                && observed.contains(.customerIOHandleNotificationResponse)
        case .pushTapCold:
            shouldClose = callback == .expoLastNotificationResponsePulled
                && observed.contains(.customerIOHandleNotificationResponse)
                && observed.contains(.expoNotificationsEmitterNotificationResponseEventSent)
        case .localNotificationTapWarm:
            shouldClose = callback == .expoNotificationsEmitterNotificationResponseEventSent
        case .localNotificationTapCold:
            shouldClose = callback == .expoLastNotificationResponsePulled
                && observed.contains(.expoNotificationsEmitterNotificationResponseEventSent)
        case .customURLWarm, .customURLCold, .liveActivityTapWarm, .liveActivityTapCold:
            shouldClose = callback == .hostRouteURL && phase == .result
        case .universalLinkWarm, .universalLinkCold:
            shouldClose = callback == .hostRouteUserActivity && phase == .result
        case .tokenRegistration:
            let common = observed.contains(.applicationDidRegisterForRemoteNotifications)
                && observed.contains(.expoSubscriberDidRegisterForRemoteNotificationsForwarded)
                && observed.contains(.customerIORegisterDeviceToken)
            if provider == .fcm {
                shouldClose = common && observed.contains(.fcmRegistrationTokenRefreshed)
            } else {
                shouldClose = common
            }
        case .registrationFailure:
            shouldClose = observed.contains(.applicationDidFailToRegisterForRemoteNotifications)
                && observed.contains(.expoSubscriberDidFailToRegisterForRemoteNotificationsForwarded)
        case .appBackgroundForeground:
            shouldClose = callback == .expoSubscriberDidBecomeActiveForwarded
                && observed.contains(.applicationDidEnterBackground)
                && observed.contains(.expoSubscriberDidEnterBackgroundForwarded)
                && observed.contains(.applicationWillEnterForeground)
                && observed.contains(.expoSubscriberWillEnterForegroundForwarded)
        default:
            shouldClose = false
        }
        if shouldClose { closeScheduled = true }
        return shouldClose
    }

    private func isRegistrationCallback(_ callback: LifecycleTraceCallback) -> Bool {
        switch callback {
        case .applicationDidRegisterForRemoteNotifications,
             .expoSubscriberDidRegisterForRemoteNotificationsForwarded,
             .fcmRegistrationTokenRefreshed,
             .customerIORegisterDeviceToken:
            return true
        default:
            return false
        }
    }
}

/// Consumes only closed, schema-shaped Foundation notifications emitted from
/// exact-hash fixture patches. It owns no lifecycle callback or delegate seat.
public final class LifecycleTraceProbeObserver: @unchecked Sendable {
    private static let state = LifecycleTraceExpoProbeState()
    private let center: NotificationCenter
    private var tokens: [NSObjectProtocol] = []

    public init(center: NotificationCenter = .default) {
        self.center = center
        tokens.append(center.addObserver(
            forName: LifecycleTraceProbe.notificationName,
            object: center,
            queue: nil
        ) { [weak self] notification in
            self?.recordProbeNotification(notification)
        })

        let environment = ProcessInfo.processInfo.environment
        if let scenarioValue = environment["CIO_LIFECYCLE_SCENARIO"],
           let scenario = LifecycleTraceScenario(rawValue: scenarioValue),
           LifecycleTraceExpoSupport.isColdStart(scenario) {
            let rctNotifications: [(String, LifecycleTraceCallback)] = [
                ("RCTJavaScriptWillStartLoadingNotification", .rctJavaScriptWillStartLoadingNotification),
                ("RCTJavaScriptDidLoadNotification", .rctJavaScriptDidLoadNotification),
                ("RCTJavaScriptDidFailToLoadNotification", .rctJavaScriptDidFailToLoadNotification),
                ("RCTDidInitializeModuleNotification", .rctDidInitializeModuleNotification),
                ("RCTBridgeWillReloadNotification", .rctBridgeWillReloadNotification),
                ("RCTBridgeDidInvalidateModulesNotification", .rctBridgeDidInvalidateModulesNotification),
                ("RCTInstanceDidLoadBundle", .rctInstanceDidLoadBundleNotification),
            ]
            for (name, callback) in rctNotifications {
                tokens.append(center.addObserver(
                    forName: Notification.Name(name),
                    object: nil,
                    queue: nil
                ) { [weak self] _ in
                    self?.recordRCTNotification(callback)
                })
            }
        }
    }

    deinit {
        for token in tokens {
            center.removeObserver(token)
        }
    }

    private func recordProbeNotification(_ notification: Notification) {
        guard notification.object as AnyObject? === center,
              let userInfo = notification.userInfo,
              userInfo[LifecycleTraceProbe.processInstanceIDKey] as? String
              == LifecycleTraceHarness.sharedRecorder?.processInstanceID,
              let callbackValue = userInfo["callback"] as? String,
              let callback = LifecycleTraceCallback(rawValue: callbackValue),
              let ownerValue = userInfo["owner"] as? String,
              let owner = LifecycleTraceOwner(rawValue: ownerValue),
              let kindValue = userInfo["kind"] as? String,
              let kind = LifecycleTraceKind(rawValue: kindValue),
              let phaseValue = userInfo["phase"] as? String,
              let phase = LifecycleTracePhase(rawValue: phaseValue),
              let flags = Self.closedFlags(userInfo["flags"]),
              let counts = Self.closedCounts(userInfo["counts"]),
              let enums = Self.closedEnums(userInfo["enums"]),
              let suppliedCorrelations = Self.closedCorrelations(userInfo["raw_correlation"]) else {
            return
        }

        let correlations = Self.state.correlations(
            for: callback,
            supplied: suppliedCorrelations
        )

        let recorded = LifecycleTraceHarness.sharedRecorder?.record(
            callback: callback,
            owner: owner,
            kind: kind,
            phase: phase,
            observations: LifecycleTraceObservation(
                flags: flags,
                counts: counts,
                enums: enums,
                correlations: correlations
            )
        ) ?? false
        guard recorded else { return }
        Self.closeScenarioIfTerminal(after: callback, phase: phase)
    }

    private func recordRCTNotification(_ callback: LifecycleTraceCallback) {
        let correlations = Self.state.correlations(for: callback, supplied: [:])
        let recorded = LifecycleTraceHarness.sharedRecorder?.record(
            callback: callback,
            owner: .rctNotification,
            kind: .observerNotification,
            phase: .stateChange,
            observations: LifecycleTraceObservation(correlations: correlations)
        ) ?? false
        guard recorded else { return }
        Self.closeScenarioIfTerminal(after: callback, phase: .stateChange)
    }

    private static func closeScenarioIfTerminal(
        after callback: LifecycleTraceCallback,
        phase: LifecycleTracePhase
    ) {
        let environment = ProcessInfo.processInfo.environment
        guard let scenarioValue = environment["CIO_LIFECYCLE_SCENARIO"],
              let scenario = LifecycleTraceScenario(rawValue: scenarioValue),
              let providerValue = environment["CIO_LIFECYCLE_PROVIDER"],
              let provider = LifecycleTraceProvider(rawValue: providerValue),
              state.canClose(
                  scenario: scenario,
                  provider: provider,
                  after: callback,
                  phase: phase
              ) else {
            return
        }

        let terminal: LifecycleTraceTerminal
        switch scenario {
        case .iconColdLaunch, .appBackgroundForeground:
            terminal = .activeScene
        case .pushTapWarm, .pushTapCold, .localNotificationTapWarm, .localNotificationTapCold:
            terminal = .notificationResponse
        case .customURLWarm, .customURLCold, .liveActivityTapWarm, .liveActivityTapCold:
            terminal = .hostURLRoute
        case .universalLinkWarm, .universalLinkCold:
            terminal = .hostUserActivityRoute
        case .tokenRegistration:
            terminal = .tokenRegistration
        case .registrationFailure:
            terminal = .registrationFailure
        default:
            return
        }
        DispatchQueue.main.async {
            LifecycleTraceHarness.endScenario(after: terminal)
        }
    }

    private static func closedFlags(_ value: Any?) -> [LifecycleTraceFlag: Bool]? {
        guard let values = value as? [String: Bool] ?? (value == nil ? [:] : nil) else {
            return nil
        }
        var result: [LifecycleTraceFlag: Bool] = [:]
        for (key, value) in values {
            guard let closed = LifecycleTraceFlag(rawValue: key) else { return nil }
            result[closed] = value
        }
        return result
    }

    private static func closedCounts(_ value: Any?) -> [LifecycleTraceCount: Int]? {
        guard let values = value as? [String: Int] ?? (value == nil ? [:] : nil) else {
            return nil
        }
        var result: [LifecycleTraceCount: Int] = [:]
        for (key, value) in values {
            guard value >= 0, let closed = LifecycleTraceCount(rawValue: key) else { return nil }
            result[closed] = value
        }
        return result
    }

    private static func closedEnums(_ value: Any?) -> [LifecycleTraceEnum: String]? {
        guard let values = value as? [String: String] ?? (value == nil ? [:] : nil) else {
            return nil
        }
        var result: [LifecycleTraceEnum: String] = [:]
        for (key, value) in values {
            guard let closed = LifecycleTraceEnum(rawValue: key),
                  isClosedEnumValue(value, for: closed) else {
                return nil
            }
            result[closed] = value
        }
        return result
    }

    private static func isClosedEnumValue(
        _ value: String,
        for key: LifecycleTraceEnum
    ) -> Bool {
        let allowed: [String]
        switch key {
        case .appState:
            allowed = ["pre-application", "active", "inactive", "background", "unknown", "off-main-thread"]
        case .urlScheme:
            allowed = ["https", "http", "custom", "unknown", "none"]
        case .urlClass:
            allowed = ["cio-live-activity", "web", "custom-scheme", "other", "none"]
        case .actionClass:
            allowed = ["default", "dismiss", "custom", "none"]
        case .activityClass:
            allowed = ["web-browsing", "custom", "none"]
        case .sceneRole:
            allowed = ["application", "external-display", "unknown", "none"]
        case .sceneState:
            allowed = ["unattached", "foreground-active", "foreground-inactive", "background", "unknown", "none"]
        case .result:
            allowed = ["handled", "unhandled", "redirect", "success", "failure", "new-data", "no-data", "none", "unknown"]
        case .notificationOrigin:
            allowed = ["remote", "local", "unknown", "none"]
        case .notificationClass:
            allowed = ["customerio", "non-customerio", "unknown", "none"]
        case .delegatePeer:
            allowed = [
                "host",
                "customerio-messaging-push",
                "expo-notifications",
                "flutter-local-notifications",
                "react-native-push-notification",
                "framework-other",
                "unknown",
                "none",
            ]
        case .presentationClass:
            allowed = ["visible", "suppressed", "unknown", "none"]
        case .errorClass:
            allowed = ["registration", "configuration", "routing", "other", "none"]
        }
        return allowed.contains(value)
    }

    private static func closedCorrelations(
        _ value: Any?
    ) -> [LifecycleTraceAliasNamespace: LifecycleTraceCorrelationValue]? {
        guard let values = value as? [String: String] ?? (value == nil ? [:] : nil) else {
            return nil
        }
        var result: [LifecycleTraceAliasNamespace: LifecycleTraceCorrelationValue] = [:]
        for (key, value) in values {
            guard !value.isEmpty,
                  let closed = LifecycleTraceAliasNamespace(rawValue: key) else {
                return nil
            }
            result[closed] = .string(value)
        }
        return result
    }
}

/// Called from the test pod's Objective-C +load hook, before app launch.
@objc(CioLifecycleProbeBootstrapSupport)
public final class CioLifecycleProbeBootstrapSupport: NSObject {
    private static let lock = NSLock()
    private static var observer: LifecycleTraceProbeObserver?

    @objc
    public static func start() {
        lock.lock()
        defer { lock.unlock() }
        guard observer == nil else { return }
        let environment = ProcessInfo.processInfo.environment
        guard environment["CIO_LIFECYCLE_INTEGRATION"] == "expo",
              environment["CIO_LIFECYCLE_RUNTIME"] == "swift",
              let scenarioValue = environment["CIO_LIFECYCLE_SCENARIO"],
              let scenario = LifecycleTraceScenario(rawValue: scenarioValue),
              LifecycleTraceExpoSupport.supports(scenario),
              LifecycleTraceHarness.configureFromEnvironment(
                  sink: ConsoleLifecycleTraceSink()
              ) != nil else {
            return
        }
        observer = LifecycleTraceProbeObserver()
        _ = LifecycleTraceHarness.startScenario()
    }
}
