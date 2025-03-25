const { testAppPath, createPartialSnapshot } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const notificationServicePath = path.join(iosPath, "NotificationService/NotificationService.swift");

describe('APN NotificationService.swift', () => {
  test("Plugin creates NotificationService.swift with required methods", async () => {
    const content = await fs.readFile(notificationServicePath, "utf8");
    
    // Check for required elements rather than exact snapshot
    const requiredElements = [
      'didReceive',
      'withContentHandler',
      'serviceExtensionTimeWillExpire'
    ];
    
    requiredElements.forEach(element => {
      expect(content).toContain(element);
    });
  });
  
  test("NotificationService.swift has expected APN configuration", async () => {
    const content = await fs.readFile(notificationServicePath, "utf8");
    
    // Check for APN vs FCM implementation details
    expect(content).toContain('MessagingPush');
    expect(content).toContain('CioMessagingPushAPN');
  });
});
