const { testAppPath, testAppName } = require('../../utils');
const fs = require('fs-extra');
const path = require('path');

const testProjectPath = testAppPath();
const iosPath = path.join(testProjectPath, 'ios');
const appDelegateImplPath = path.join(
  iosPath,
  `${testAppName()}/AppDelegate.mm`
);

test('Plugin injects CIO imports and calls into AppDelegate.mm', async () => {
  const content = await fs.readFile(appDelegateImplPath, 'utf8');

  expect(content).toMatchInlineSnapshot(`
    "
    #if __has_include(<EXNotifications/EXNotificationCenterDelegate.h>)
    #import <EXNotifications/EXNotificationCenterDelegate.h>
    #endif


    // Add swift bridge imports
    #import <ExpoModulesCore-Swift.h>
    #import <${testAppName()}-Swift.h>
      
    #import "AppDelegate.h"

    #import <React/RCTBundleURLProvider.h>
    #import <React/RCTLinkingManager.h>

    @implementation AppDelegate


    CIOAppPushNotificationsHandler* pnHandlerObj = [[CIOAppPushNotificationsHandler alloc] init];

    - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
    {
      self.moduleName = @"main";

      // You can add your custom initial props in the dictionary below.
      // They will be passed down to the ViewController used by React Native.
      self.initialProps = @{};

      
      [pnHandlerObj initializeCioSdk];

    // Code to make the CIO SDK compatible with expo-notifications package.
    // 
    // The CIO SDK and expo-notifications both need to handle when a push gets clicked. However, iOS only allows one click handler to be set per app.
    // To get around this limitation, we set the CIO SDK as the click handler. The CIO SDK sets itself up so that when another SDK or host iOS app 
    // sets itself as the click handler, the CIO SDK will still be able to handle when the push gets clicked, even though it's not the designated 
    // click handler in iOS at runtime. 
    // 
    // This should work for most SDKs. However, expo-notifications is unique in it's implementation. It will not setup push click handling it if detects 
    // that another SDK or host iOS app has already set itself as the click handler:
    // https://github.com/expo/expo/blob/1b29637bec0b9888e8bc8c310476293a3e2d9786/packages/expo-notifications/ios/EXNotifications/Notifications/EXNotificationCenterDelegate.m#L31-L37
    // ...to get around this, we must manually set it as the click handler after the CIO SDK. That's what this code block does.
    //
    // Note: Initialize the native iOS SDK and setup SDK push click handling before running this code. 
    # if __has_include(<EXNotifications/EXNotificationCenterDelegate.h>)
      // Creating a new instance, as the comments in expo-notifications suggests, does not work. With this code, if you send a CIO push to device and click on it,
      // no push metrics reporting will occur.
      // EXNotificationCenterDelegate *notificationCenterDelegate = [[EXNotificationCenterDelegate alloc] init];

      // ...instead, get the singleton reference from Expo. 
      id<UNUserNotificationCenterDelegate> notificationCenterDelegate = (id<UNUserNotificationCenterDelegate>) [EXModuleRegistryProvider getSingletonModuleForClass:[EXNotificationCenterDelegate class]];
      UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
      center.delegate = notificationCenterDelegate;
    # endif

      return [super application:application didFinishLaunchingWithOptions:launchOptions];
    }

    - (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
    {
      return [self bundleURL];
    }

    - (NSURL *)bundleURL
    {
    #if DEBUG
      return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@".expo/.virtual-metro-entry"];
    #else
      return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
    #endif
    }

    // Linking API
    - (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options {
      return [super application:application openURL:url options:options] || [RCTLinkingManager application:application openURL:url options:options];
    }

    // Universal Links
    - (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler {
      BOOL result = [RCTLinkingManager application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
      return [super application:application continueUserActivity:userActivity restorationHandler:restorationHandler] || result;
    }

    // Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
    - (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
    {
      
      [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
      return [pnHandlerObj application:application deviceToken:deviceToken];

    }

    // Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
    - (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
    {
      
      [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
      [pnHandlerObj application:application error:error];

    }

    // Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
    - (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
    {
      return [super application:application didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
    }

    @end
    "
  `);
});
