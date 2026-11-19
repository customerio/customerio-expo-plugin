import Foundation
import UserNotifications
import CioMessagingPushAPN

@objc
public class NotificationServiceCioManager : NSObject {
  
  public override init() {}
  
  @objc(didReceive:withContentHandler:)
  public func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    MessagingPushAPN.initializeForExtension(
      withConfig: MessagingPushConfigBuilder(cdpApiKey: Env.customerIOCdpApiKey)
        .region(Env.customerIORegion)
{{API_HOST_BUILDER_LINE}}{{APP_GROUP_ID_BUILDER_LINE}}        .build()
    )
    
    // `didReceive` returns false for pushes Customer.io didn't send (e.g. from another
    // push provider) and then never calls the handler, so deliver those unchanged
    // instead of leaving iOS to show them when the extension times out. It also returns
    // false after calling the handler itself when the SDK isn't initialized, hence the guard.
    var delivered = false
    let deliver: (UNNotificationContent) -> Void = { content in
      guard !delivered else { return }
      delivered = true
      contentHandler(content)
    }
    if !MessagingPush.shared.didReceive(request, withContentHandler: deliver) {
      deliver(request.content)
    }
  }
  
  @objc(serviceExtensionTimeWillExpire)
  public func serviceExtensionTimeWillExpire() {
    MessagingPush.shared.serviceExtensionTimeWillExpire()
  }
}
