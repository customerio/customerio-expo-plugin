const { testAppPath, testAppName, createPartialSnapshot } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const pushServicePath = path.join(iosPath, `${testAppName()}/PushService.swift`);

describe('APN PushService.swift', () => {
  test("Plugin creates PushService.swift with required methods", async () => {
    const content = await fs.readFile(pushServicePath, "utf8");
    
    // Check for required elements rather than exact snapshot
    const requiredElements = [
      'MessagingPush.shared.application',
      'didRegisterForRemoteNotificationsWithDeviceToken',
      'didFailToRegisterForRemoteNotificationsWithError',
      'public class CIOAppPushNotificationsHandler'
    ];
    
    requiredElements.forEach(element => {
      expect(content).toContain(element);
    });
  });
  
  test("PushService has expected APN-specific methods", async () => {
    const content = await fs.readFile(pushServicePath, "utf8");
    
    // Check for APN vs FCM - APN doesn't include Firebase references
    expect(content).not.toContain('FirebaseMessaging');
  });
});
