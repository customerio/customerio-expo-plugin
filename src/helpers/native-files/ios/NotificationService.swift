import Foundation
import UserNotifications
import CioTracking
import CioMessagingPushAPN

@objc
public class NotificationServiceCioManager : NSObject {

    public override init() {}

    @objc(didReceive:withContentHandler:)
    public func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        CustomerIO
            .initialize(siteId: Env.customerIOSiteId, apiKey: Env.customerIOApiKey, region: Region.US) { config in }
        MessagingPush.shared.didReceive(request, withContentHandler: contentHandler)
    }

    @objc(serviceExtensionTimeWillExpire)
    public func serviceExtensionTimeWillExpire() {
        MessagingPush.shared.serviceExtensionTimeWillExpire()
    }
}
