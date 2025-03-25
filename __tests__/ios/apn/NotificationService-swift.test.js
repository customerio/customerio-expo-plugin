const { testAppPath, createPartialSnapshot } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const notificationServicePath = path.join(iosPath, "NotificationService/NotificationService.swift");

describe('APN NotificationService.swift', () => {
  test("Plugin creates NotificationService.swift with required methods", async () => {
    const content = await fs.readFile(notificationServicePath, "utf8");
    
    // Core methods that must exist in the notification service
    const requiredMethods = [
      'didReceive',
      'withContentHandler', 
      'serviceExtensionTimeWillExpire',
      'MessagingPush.shared.didReceive',
      'MessagingPush.shared.serviceExtensionTimeWillExpire'
    ];
    
    // Check for all required methods
    requiredMethods.forEach(element => {
      expect(content).toContain(element);
    });
    
    // The notification service should contain initialization code
    expect(content).toContain('initializeForExtension');
  });
  
  test("NotificationService.swift has expected APN configuration", async () => {
    const content = await fs.readFile(notificationServicePath, "utf8");
    
    // Check for APN vs FCM implementation details
    expect(content).toContain('MessagingPush');
    expect(content).toContain('CioMessagingPushAPN');
  });
});
