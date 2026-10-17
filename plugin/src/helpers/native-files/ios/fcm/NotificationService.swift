import Foundation
import UserNotifications
import CioMessagingPushFCM

@objc
public class NotificationServiceCioManager : NSObject {
  
  public override init() {}
  
  @objc(didReceive:withContentHandler:)
  public func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    let builder = MessagingPushConfigBuilder(cdpApiKey: Env.customerIOCdpApiKey)
        .region(Env.customerIORegion)
{{APP_GROUP_ID_BUILDER_LINE}}    if let logLevel = Env.customerIOLogLevel {
      builder.logLevel(logLevel)
    }
    MessagingPushFCM.initializeForExtension(withConfig: builder.build())
    
    MessagingPush.shared.didReceive(request, withContentHandler: contentHandler)
  }
  
  @objc(serviceExtensionTimeWillExpire)
  public func serviceExtensionTimeWillExpire() {
    MessagingPush.shared.serviceExtensionTimeWillExpire()
  }
}
