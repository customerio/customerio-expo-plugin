import Foundation
import UserNotifications
import CioMessagingPushFCM

@objc
public class NotificationServiceCioManager : NSObject {
  
  public override init() {}
  
  @objc(didReceive:withContentHandler:)
  public func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    MessagingPushFCM.initializeForExtension(
      withConfig: MessagingPushConfigBuilder(cdpApiKey: Env.customerIOCdpApiKey)
        .region(Env.customerIORegion)
        .build()
    )
    
    MessagingPush.shared.didReceive(request, withContentHandler: contentHandler)
  }
  
  @objc(serviceExtensionTimeWillExpire)
  public func serviceExtensionTimeWillExpire() {
    MessagingPush.shared.serviceExtensionTimeWillExpire()
  }
}
