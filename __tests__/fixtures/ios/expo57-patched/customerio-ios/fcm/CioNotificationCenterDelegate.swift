import CioInternalCommon
import UIKit

private let cioLifecycleProbeNotification = Notification.Name("io.customer.lifecycle-trace.probe.v1")

private func cioLifecycleProbeRecord(
  _ callback: String,
  owner: String,
  kind: String,
  phase: String,
  facts: [String: Any]
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
  center.post(name: cioLifecycleProbeNotification, object: center, userInfo: userInfo)
}

private func cioLifecycleNotificationFacts(
  _ notification: UNNotification,
  response: UNNotificationResponse? = nil
) -> [String: Any] {
  let userInfo = notification.request.content.userInfo
  var correlation: [String: String] = ["request": notification.request.identifier]
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
    "delegate_peer": "customerio-messaging-push"
  ]
  if let response {
    switch response.actionIdentifier {
    case UNNotificationDefaultActionIdentifier: enums["action_class"] = "default"
    case UNNotificationDismissActionIdentifier: enums["action_class"] = "dismiss"
    default: enums["action_class"] = "custom"
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

@available(iOSApplicationExtension, unavailable)
open class CioNotificationCenterDelegate: NSObject, UNUserNotificationCenterDelegate {
    private let messagingPush: MessagingPushInstance
    private let config: ConfigInstance?
    private var wrappedNotificationCenterDelegate: UNUserNotificationCenterDelegate?

    public init(
        messagingPush: MessagingPushInstance,
        config: ConfigInstance?,
        wrappedDelegate: UNUserNotificationCenterDelegate?
    ) {
        self.messagingPush = messagingPush
        self.config = config
        self.wrappedNotificationCenterDelegate = wrappedDelegate
        super.init()
    }

    open func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        cioLifecycleProbeRecord(
            "notification-center.will-present",
            owner: "notification-center-delegate",
            kind: "os-callback",
            phase: "entry",
            facts: cioLifecycleNotificationFacts(notification)
        )
        if let wrappedNotificationCenterDelegate = wrappedNotificationCenterDelegate,
           wrappedNotificationCenterDelegate.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) {
            // Pass completionHandler directly to support async implementations (e.g. a React Native JS bridge that
            // calls back from the JS thread). A previous wrapper-closure approach tracked whether the handler was
            // called synchronously and provided a fallback if not; that broke async delegates by invoking the
            // handler a second time with the SDK default options.
            // Trade-off: a delegate that returns true from responds(to:) but never calls the handler will now leave
            // it uncalled. No known SDK or framework exhibits this behaviour by default; it would represent a bug
            // in the host app's delegate code.
            wrappedNotificationCenterDelegate.userNotificationCenter?(
                center,
                willPresent: notification,
                withCompletionHandler: completionHandler
            )
            return
        }

        if config?().showPushAppInForeground ?? false {
            if #available(iOS 14.0, *) {
                completionHandler([.list, .banner, .badge, .sound])
            } else {
                completionHandler([.alert, .badge, .sound])
            }
        } else {
            completionHandler([])
        }
    }

    // Function called when a push notification is clicked or swiped away.
    open func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let lifecycleFacts = cioLifecycleNotificationFacts(response.notification, response: response)
        cioLifecycleProbeRecord(
            "notification-center.did-receive-response",
            owner: "notification-center-delegate",
            kind: "os-callback",
            phase: "entry",
            facts: lifecycleFacts
        )
        // Cast to concrete type since method was removed from protocol
        let customerIOHandled: Bool
        if let implementation = messagingPush as? MessagingPush {
            customerIOHandled = implementation.userNotificationCenter(center, didReceive: response) != nil
        } else {
            customerIOHandled = false
        }
        let enums = lifecycleFacts["enums"] as? [String: String] ?? [:]
        if customerIOHandled,
           enums["notification_class"] == "customerio",
           enums["action_class"] == "default" {
            var terminalFacts = lifecycleFacts
            var terminalEnums = enums
            terminalEnums["result"] = "handled"
            terminalFacts["enums"] = terminalEnums
            cioLifecycleProbeRecord(
                "customerio.handle-notification-response",
                owner: "customerio-sdk",
                kind: "sdk-routing",
                phase: "result",
                facts: terminalFacts
            )
        }

        if let wrappedNotificationCenterDelegate = wrappedNotificationCenterDelegate,
           wrappedNotificationCenterDelegate.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) {
            // Pass completionHandler directly to support async implementations (e.g. a React Native JS bridge that
            // calls back from the JS thread). A previous wrapper-closure approach tracked whether the handler was
            // called synchronously and provided a fallback if not; that broke async delegates by invoking the
            // handler a second time.
            // Trade-off: a delegate that returns true from responds(to:) but never calls the handler will now leave
            // it uncalled. No known SDK or framework exhibits this behaviour by default; it would represent a bug
            // in the host app's delegate code.
            wrappedNotificationCenterDelegate.userNotificationCenter?(
                center,
                didReceive: response,
                withCompletionHandler: completionHandler
            )
            return
        }

        completionHandler()
    }

    /// Prevent issues caused by swizzling in various SDKs that check for method existence without using
    /// `responds(to:)` (e.g. FirebaseMessaging). An empty stub ensures the method exists for forwarding.
    open func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {
        wrappedNotificationCenterDelegate?.userNotificationCenter?(center, openSettingsFor: notification)
    }
}
