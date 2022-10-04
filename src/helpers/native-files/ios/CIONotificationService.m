
#import "CIONotificationService.h"
// MARK: - CIO-TECH-ASSISTANCE
// Import "Your-target-name-Swift.h" file
#import "CIONotificationService-Swift.h"

@interface NotificationService ()

@property (nonatomic, strong) void (^contentHandler)(UNNotificationContent *contentToDeliver);
@property (nonatomic, strong) UNMutableNotificationContent *bestAttemptContent;

@end

@implementation NotificationService

- (void)didReceiveNotificationRequest:(UNNotificationRequest *)request withContentHandler:(void (^)(UNNotificationContent * _Nonnull))contentHandler {
    // MARK: - CIO-TECH-ASSISTANCE
    NotificationServiceCioManager* cioManagerObj = [[NotificationServiceCioManager alloc] init];
    [cioManagerObj didReceive:request withContentHandler:contentHandler];
}

- (void)serviceExtensionTimeWillExpire {
    // Called just before the extension will be terminated by the system.
    // Use this as an opportunity to deliver your "best attempt" at modified content, otherwise the original push payload will be used.
    // MARK: - CIO-TECH-ASSISTANCE
    NotificationServiceCioManager* cioManagerObj = [[NotificationServiceCioManager alloc] init];
    [cioManagerObj serviceExtensionTimeWillExpire];
}

@end
