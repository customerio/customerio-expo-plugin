import UserNotifications
import CioMessagingPush
class NotificationService: UNNotificationServiceExtension {
   
      override func didReceive(_ request: UNNotificationRequest,
                               withContentHandler contentHandler:
                               @escaping (UNNotificationContent) -> Void) {
        
        MessagingPush.shared.didReceive(request, withContentHandler: contentHandler)

      }
  
      override func serviceExtensionTimeWillExpire() {
        MessagingPush.shared.serviceExtensionTimeWillExpire()
      }
  
}
   
