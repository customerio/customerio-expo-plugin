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
@_spi(Internal) import CioMessagingPush

@available(iOSApplicationExtension, unavailable)
open class CioAppDelegate: CioProviderAgnosticAppDelegate {
    /// Temporary solution, until interfaces MessagingPushInstance/MessagingPushAPNInstance/MessagingPushFCMInstance are fixed
    private var messagingPushAPN: MessagingPushAPNInstance? {
        messagingPush as? MessagingPushAPNInstance
    }

    public convenience init() {
        DIGraphShared.shared.logger.error("CIO: This no-argument initializer should not to be used. Added since UIKit's AppDelegate initialization process crashes if for no-arg init is missing.")
        self.init(
            messagingPush: MessagingPush.shared,
            appDelegate: nil,
            config: nil,
            logger: DIGraphShared.shared.logger
        )
    }

    override public func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)

        if let messagingPushAPN {
            messagingPushAPN.registerDeviceToken(apnDeviceToken: deviceToken)
            cioLifecycleProbeRecord(
                "customerio.register-device-token",
                owner: "customerio-sdk",
                kind: "sdk-routing",
                phase: "result",
                facts: [
                    "flags": ["has_device_token": true],
                    "counts": ["device_token_bytes": deviceToken.count]
                ]
            )
        }
    }
}

@available(iOSApplicationExtension, unavailable)
open class CioAppDelegateWrapper<UserAppDelegate: CioAppDelegateType>: CioAppDelegate {
    public init() {
        super.init(
            messagingPush: MessagingPush.shared,
            appDelegate: UserAppDelegate(),
            config: { MessagingPush.moduleConfig },
            logger: DIGraphShared.shared.logger
        )
    }
}
