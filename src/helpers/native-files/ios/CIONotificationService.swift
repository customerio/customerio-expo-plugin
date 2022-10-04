import Foundation
import UserNotifications
import CioMessagingPush

// MARK: - CIO-TECH-ASSISTANCE
// This is another example of handling ObjC calls for Swift CustomerIO SDK
@objc
public class NotificationServiceCioManager : NSObject {

    public override init() {}

    @objc(didReceive:withContentHandler:)
    public func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        MessagingPush.shared.didReceive(request, withContentHandler: contentHandler)
    }

    @objc(serviceExtensionTimeWillExpire)
    public func serviceExtensionTimeWillExpire() {
        MessagingPush.shared.serviceExtensionTimeWillExpire()
    }
}
