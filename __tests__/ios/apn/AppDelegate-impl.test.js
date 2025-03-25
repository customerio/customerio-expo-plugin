const { getTestPaths } = require('../../helpers/testConfig');
const { extractImports } = require('../../helpers/parsers');
const { createPartialSnapshot } = require('../../utils');
const fs = require('fs-extra');

describe('iOS AppDelegate Customizations for APN', () => {
  const { getAppDelegatePath } = getTestPaths();
  const appDelegateImplPath = getAppDelegatePath();

  test('Plugin injects CIO imports and handler initialization', async () => {
    const content = await fs.readFile(appDelegateImplPath, 'utf8');
    
    // Using our custom matcher
    expect(content).toHaveCIOInitialization();
    
    // Check for required imports
    const imports = await extractImports(appDelegateImplPath);
    expect(imports.some(line => line.includes('ExpoModulesCore-Swift.h'))).toBe(true);
    
    // Create a partial snapshot with only the key elements we care about
    const partialSnapshot = createPartialSnapshot(content, {
      include: [
        'CIOAppPushNotificationsHandler* pnHandlerObj', 
        '[pnHandlerObj initializeCioSdk]',
        '[pnHandlerObj application:application deviceToken:deviceToken]',
        '[pnHandlerObj application:application error:error]'
      ],
      patterns: [
        /CIOAppPushNotificationsHandler.*pnHandlerObj.*=.*\[\[CIOAppPushNotificationsHandler alloc\] init\]/,
        /\[pnHandlerObj initializeCioSdk\]/
      ]
    });
    
    // Verify all required elements are present
    Object.entries(partialSnapshot.includes).forEach(([key, value]) => {
      expect(value).toBe(true);
    });
    
    // Check for expo-notifications compatibility code
    expect(content).toContain('__has_include(<EXNotifications/EXNotificationCenterDelegate.h>)');
    expect(content).toContain('UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter]');
  });

  // We can also test the entire structure if needed with inline snapshot
  test('Plugin creates correct AppDelegate structure', async () => {
    const content = await fs.readFile(appDelegateImplPath, 'utf8');
    
    // This still uses inline snapshot but now we're focusing more on structural elements
    // that are less likely to change between Expo versions
    expect(content).toContain('didRegisterForRemoteNotificationsWithDeviceToken');
    expect(content).toContain('didFailToRegisterForRemoteNotificationsWithError');
    expect(content).toContain('didReceiveRemoteNotification');
  });
});
