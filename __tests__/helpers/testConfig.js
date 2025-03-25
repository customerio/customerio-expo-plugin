/**
 * Manages test configuration and parameters for different Expo versions
 */

const { testAppPath, testAppName } = require('../utils');
const path = require('path');

/**
 * Known variations or quirks in different Expo versions
 * that affect how we should test our plugin
 */
const EXPO_VERSION_BEHAVIORS = {
  DEFAULT: {
    // Default behaviors for any version
  },
  '48': {
    // Specific behaviors for Expo 48
  },
  '49': {
    // Specific behaviors for Expo 49
  },
  '50': {
    // Specific behaviors for Expo 50
  },
  '51': {
    // Specific behaviors for Expo 51
  },
  '52': {
    // Specific behaviors for Expo 52
  },
};

/**
 * Gets the appropriate test behaviors for the current Expo version
 */
function getVersionBehaviors() {
  // Get Expo version from env or try to detect it
  const expoVersion = process.env.TEST_EXPO_VERSION || 'DEFAULT';
  return EXPO_VERSION_BEHAVIORS[expoVersion] || EXPO_VERSION_BEHAVIORS.DEFAULT;
}

/**
 * Test parameters for different configurations
 */
const TEST_PARAMS = {
  IOS_PUSH_PROVIDERS: ['apn', 'fcm'],
  PLATFORMS: ['ios', 'android'],
};

/**
 * Gets paths for the current test environment
 */
function getTestPaths() {
  const appPath = testAppPath();
  return {
    androidPath: path.join(appPath, 'android'),
    iosPath: path.join(appPath, 'ios'),
    appName: testAppName(),
    appPath,
    
    // Android file paths
    appManifestPath: path.join(appPath, 'android/app/src/main/AndroidManifest.xml'),
    appBuildGradlePath: path.join(appPath, 'android/app/build.gradle'),
    mainBuildGradlePath: path.join(appPath, 'android/build.gradle'),
    
    // iOS file paths
    getAppDelegatePath: (name = testAppName()) => 
      path.join(appPath, `ios/${name}/AppDelegate.mm`),
    
    getPodfilePath: () => 
      path.join(appPath, 'ios/Podfile'),
    
    getNotificationServicePath: (name = testAppName()) => 
      path.join(appPath, `ios/NotificationService/NotificationService.m`),
    
    getNotificationServiceSwiftPath: (provider, name = testAppName()) => 
      path.join(appPath, `ios/NotificationService/NotificationService.swift`),
    
    getPushServiceSwiftPath: (provider, name = testAppName()) => 
      path.join(appPath, `ios/${name}/PushService.swift`),
  };
}

module.exports = {
  getTestPaths,
  getVersionBehaviors,
  TEST_PARAMS,
};