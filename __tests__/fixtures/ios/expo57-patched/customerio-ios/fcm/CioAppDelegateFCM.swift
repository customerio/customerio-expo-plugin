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
open class CioAppDelegate: CioProviderAgnosticAppDelegate, FirebaseServiceDelegate {
    /// Temporary solution, until interfaces MessagingPushInstance/MessagingPushAPNInstance/MessagingPushFCMInstance are fixed
    private var messagingPushFCM: MessagingPushFCMInstance? {
        messagingPush as? MessagingPushFCMInstance
    }

    private var firebaseService: FirebaseService?
    private var wrappedFirebaseDelegate: FirebaseServiceDelegate?

    public convenience init() {
        DIGraphShared.shared.logger.error("CIO: This no-argument initializer should not to be used. Added since UIKit's AppDelegate initialization process crashes if for no-arg init is missing.")
        self.init(
            messagingPush: MessagingPush.shared,
            appDelegate: nil,
            logger: DIGraphShared.shared.logger
        )
    }

    override public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)

        if config?().autoFetchDeviceToken ?? false {
            if var service = MessagingPushFCM.shared.firebaseMessaging() {
                wrappedFirebaseDelegate = service.delegate
                service.delegate = self
            } else {
                DIGraphShared.shared.logger.error("CIO: firebaseService is nil. Make sure to initialize the MessagingPushFCM SDK before use.")
            }
        }

        return result
    }

    // MARK: - FirebaseServiceDelegate

    public func didReceiveRegistrationToken(_ token: String?) {
        if let token {
            let facts: [String: Any] = [
                "flags": ["has_fcm_token": true],
                "counts": ["fcm_token_characters": token.count]
            ]
            cioLifecycleProbeRecord(
                "fcm.registration-token-refreshed",
                owner: "fcm-messaging-delegate",
                kind: "framework-callback",
                phase: "entry",
                facts: facts
            )
        }
        if let wrappedFirebaseDelegate {
            wrappedFirebaseDelegate.didReceiveRegistrationToken(token)
        }

        // Forward the device token to the Customer.io SDK:
        if let messagingPushFCM {
            messagingPushFCM.registerDeviceToken(fcmToken: token)
            if let token {
                cioLifecycleProbeRecord(
                    "customerio.register-device-token",
                    owner: "customerio-sdk",
                    kind: "sdk-routing",
                    phase: "result",
                    facts: [
                        "flags": ["has_fcm_token": true],
                        "counts": ["fcm_token_characters": token.count]
                    ]
                )
            }
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
