const { testAppPath, testAppName, createPartialSnapshot } = require('../../utils');
const fs = require('fs-extra');
const path = require('path');

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, 'ios');
const appDelegateImplPath = path.join(
  iosPath,
  `${testAppName()}/AppDelegate.mm`
);

describe('FCM AppDelegate Implementation', () => {
  test('Plugin injects CIO imports and calls into AppDelegate.mm', async () => {
    const content = await fs.readFile(appDelegateImplPath, 'utf8');

    // Check for required imports in the app delegate
    const requiredImports = [
      `#import <${testAppName()}-Swift.h>`,
      '#import <ExpoModulesCore-Swift.h>'
    ];
    
    requiredImports.forEach(importStr => {
      expect(content).toContain(importStr);
    });
    
    // Check for CIO handler initialization
    expect(content).toContain('CIOAppPushNotificationsHandler* pnHandlerObj = [[CIOAppPushNotificationsHandler alloc] init]');
    expect(content).toContain('[pnHandlerObj initializeCioSdk]');
    
    // Check for notification handling methods
    expect(content).toContain('didRegisterForRemoteNotificationsWithDeviceToken');
    expect(content).toContain('didFailToRegisterForRemoteNotificationsWithError');
    expect(content).toContain('didReceiveRemoteNotification');
    
    // Check for notification center delegate setup for Expo compatibility
    expect(content).toContain('UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter]');
    expect(content).toContain('center.delegate = notificationCenterDelegate');
  });
});