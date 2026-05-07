import * as fs from 'fs';
import { modifyAppDelegateContents } from '../../../plugin/src/ios/withAppDelegateModifications';
import type { CustomerIOPluginOptionsIOS } from '../../../plugin/src/types/cio-types';
import { getFixturePath } from '../../utils';

const baseline = fs.readFileSync(
  getFixturePath('ios', 'AppDelegate.m'),
  'utf8'
);
const PROJECT_NAME = 'TestApp';

const props = (
  override?: Partial<
    NonNullable<CustomerIOPluginOptionsIOS['pushNotification']>
  >
): CustomerIOPluginOptionsIOS =>
  ({
    pushNotification: { provider: 'apn', ...override },
  } as CustomerIOPluginOptionsIOS);

describe('ios scenarios — modifyAppDelegateContents (Obj-C)', () => {
  it('injects imports, handler, configure, init, register and fail callbacks (default props)', () => {
    expect(modifyAppDelegateContents(baseline, PROJECT_NAME, props()))
      .toMatchInlineSnapshot(`
      "
      #if __has_include(<EXNotifications/EXNotificationCenterDelegate.h>)
      #import <EXNotifications/EXNotificationCenterDelegate.h>
      #endif


      // Add swift bridge imports
      #import <ExpoModulesCore-Swift.h>
      #import <TestApp-Swift.h>
        
      #import "AppDelegate.h"

      @implementation AppDelegate


      CIOAppPushNotificationsHandler* pnHandlerObj = [[CIOAppPushNotificationsHandler alloc] init];

      - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
      {

        // Register for push notifications
        [pnHandlerObj registerPushNotification];

        
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

      - (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
      {
        
        [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
        return [pnHandlerObj application:application deviceToken:deviceToken];

      }

      - (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
      {
        
        [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
        [pnHandlerObj application:application error:error];

      }

      @end
      "
    `);
  });

  it('skips notification configuration when disableNotificationRegistration is true', () => {
    expect(
      modifyAppDelegateContents(
        baseline,
        PROJECT_NAME,
        props({ disableNotificationRegistration: true })
      )
    ).toMatchInlineSnapshot(`
      "
      #if __has_include(<EXNotifications/EXNotificationCenterDelegate.h>)
      #import <EXNotifications/EXNotificationCenterDelegate.h>
      #endif


      // Add swift bridge imports
      #import <ExpoModulesCore-Swift.h>
      #import <TestApp-Swift.h>
        
      #import "AppDelegate.h"

      @implementation AppDelegate


      CIOAppPushNotificationsHandler* pnHandlerObj = [[CIOAppPushNotificationsHandler alloc] init];

      - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
      {
        
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

      - (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
      {
        
        [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
        return [pnHandlerObj application:application deviceToken:deviceToken];

      }

      - (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
      {
        
        [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
        [pnHandlerObj application:application error:error];

      }

      @end
      "
    `);
  });

  it('adds Firebase forward declaration when provider is fcm', () => {
    expect(
      modifyAppDelegateContents(
        baseline,
        PROJECT_NAME,
        props({ provider: 'fcm' })
      )
    ).toMatchInlineSnapshot(`
      "
      #if __has_include(<EXNotifications/EXNotificationCenterDelegate.h>)
      #import <EXNotifications/EXNotificationCenterDelegate.h>
      #endif

      @protocol FIRMessagingDelegate;

      // Add swift bridge imports
      #import <ExpoModulesCore-Swift.h>
      #import <TestApp-Swift.h>
        
      #import "AppDelegate.h"

      @implementation AppDelegate


      CIOAppPushNotificationsHandler* pnHandlerObj = [[CIOAppPushNotificationsHandler alloc] init];

      - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
      {

        // Register for push notifications
        [pnHandlerObj registerPushNotification];

        
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

      - (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
      {
        
        [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
        return [pnHandlerObj application:application deviceToken:deviceToken];

      }

      - (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
      {
        
        [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
        [pnHandlerObj application:application error:error];

      }

      @end
      "
    `);
  });

  it('adds the killed-state deep-link block when handleDeeplinkInKilledState is true', () => {
    expect(
      modifyAppDelegateContents(
        baseline,
        PROJECT_NAME,
        props({ handleDeeplinkInKilledState: true })
      )
    ).toMatchInlineSnapshot(`
      "
      #if __has_include(<EXNotifications/EXNotificationCenterDelegate.h>)
      #import <EXNotifications/EXNotificationCenterDelegate.h>
      #endif


      // Add swift bridge imports
      #import <ExpoModulesCore-Swift.h>
      #import <TestApp-Swift.h>
        
      #import "AppDelegate.h"

      @implementation AppDelegate


      CIOAppPushNotificationsHandler* pnHandlerObj = [[CIOAppPushNotificationsHandler alloc] init];

      - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
      {

        // Register for push notifications
        [pnHandlerObj registerPushNotification];

        
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

      // Deep link workaround for app killed state start
      NSMutableDictionary *modifiedLaunchOptions = [NSMutableDictionary dictionaryWithDictionary:launchOptions];
        if (launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey]) {
            NSDictionary *pushContent = launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey];
            if (pushContent[@"CIO"] && pushContent[@"CIO"][@"push"] && pushContent[@"CIO"][@"push"][@"link"]) {
              NSString *initialURL = pushContent[@"CIO"][@"push"][@"link"];
                if (!launchOptions[UIApplicationLaunchOptionsURLKey]) {
                    modifiedLaunchOptions[UIApplicationLaunchOptionsURLKey] = [NSURL URLWithString:initialURL];
                }
            }
        }
      //Deep link workaround for app killed state ends

      return [super application:application didFinishLaunchingWithOptions:modifiedLaunchOptions];
      }

      - (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
      {
        
        [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
        return [pnHandlerObj application:application deviceToken:deviceToken];

      }

      - (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
      {
        
        [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
        [pnHandlerObj application:application error:error];

      }

      @end
      "
    `);
  });

  // Idempotency note: modifyAppDelegateContents is NOT idempotent on its own.
  // The wrapper (`withAppDelegateModifications`) has an early-return guard checking
  // for the Swift-bridge import that PR 2 did not pull into the extracted helper.
  // Applying the helper twice directly therefore produces duplicate-injected
  // content. A follow-up refactor PR can move the guard into the helper to align
  // with every other PR-1/PR-2 helper, which are idempotent. Until then, idempotency
  // for this surface lives at the wrapper level only.

  // Negative-template: customer's AppDelegate.m has no @implementation block
  // (e.g., they migrated to Swift but kept a stub .m for some reason). Most
  // injection steps anchor on @implementation or didFinishLaunching; the helper
  // should still return without crashing.
  it('returns mostly unchanged content when @implementation AppDelegate is missing', () => {
    const noImplementation = [
      '#import "AppDelegate.h"',
      '// no @implementation block',
      '',
    ].join('\n');
    expect(modifyAppDelegateContents(noImplementation, PROJECT_NAME, props()))
      .toMatchInlineSnapshot(`
      "
      #if __has_include(<EXNotifications/EXNotificationCenterDelegate.h>)
      #import <EXNotifications/EXNotificationCenterDelegate.h>
      #endif


      // Add swift bridge imports
      #import <ExpoModulesCore-Swift.h>
      #import <TestApp-Swift.h>
        
      #import "AppDelegate.h"
      // no @implementation block
      "
    `);
  });
});
