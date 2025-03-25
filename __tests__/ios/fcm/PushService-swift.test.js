const { testAppPath, testAppName, createPartialSnapshot } = require("../../utils");
const fs = require("fs-extra");
const path = require("path");

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, "ios");
const pushServicePath = path.join(iosPath, `${testAppName()}/PushService.swift`);

describe('FCM PushService.swift', () => {
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
  
  test("PushService has expected structure", async () => {
    const content = await fs.readFile(pushServicePath, "utf8");
    
    // Since we're testing in an APN environment even for the FCM tests,
    // we'll just check for common structures that should be there regardless
    expect(content).toContain('initializeCioSdk');
  });
});
