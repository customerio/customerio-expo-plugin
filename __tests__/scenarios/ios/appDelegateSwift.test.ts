import * as fs from 'fs';
import {
  modifyAppDelegateForNativeSDKInitializer,
  modifyAppDelegateForPushHandler,
} from '../../../plugin/src/ios/withCIOIosSwift';
import type { CustomerIOPluginOptionsIOS } from '../../../plugin/src/types/cio-types';
import { getFixturePath } from '../../utils';

const baseline = fs.readFileSync(
  getFixturePath('ios', 'AppDelegate.swift'),
  'utf8'
);

const pushOptions = (
  override?: Partial<
    NonNullable<CustomerIOPluginOptionsIOS['pushNotification']>
  >
): CustomerIOPluginOptionsIOS =>
  ({
    pushNotification: { provider: 'apn', ...override },
  } as CustomerIOPluginOptionsIOS);

describe('ios scenarios — modifyAppDelegateForPushHandler', () => {
  it('injects the CioSdkAppDelegateHandler property and the four delegate hooks (default props)', () => {
    expect(modifyAppDelegateForPushHandler(baseline, pushOptions()))
      .toMatchInlineSnapshot(`
      "import Expo
      import React

      @UIApplicationMain
      public class AppDelegate: ExpoAppDelegate {
        let cioSdkHandler = CioSdkAppDelegateHandler()

        public override func application(
          _ application: UIApplication,
          didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
        ) -> Bool {
            cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)

          return super.application(application, didFinishLaunchingWithOptions: launchOptions)
        }

        // Handle device token registration
        public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
          // Call CustomerIO SDK handler
          cioSdkHandler.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
          super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
        }

        // Handle remote notification registration errors
        public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
          // Call CustomerIO SDK handler
          cioSdkHandler.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
          super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
        }
      }
      "
    `);
  });

  it('adds the killed-state deep-link block when handleDeeplinkInKilledState is true', () => {
    expect(
      modifyAppDelegateForPushHandler(
        baseline,
        pushOptions({ handleDeeplinkInKilledState: true })
      )
    ).toMatchInlineSnapshot(`
      "import Expo
      import React

      @UIApplicationMain
      public class AppDelegate: ExpoAppDelegate {
        let cioSdkHandler = CioSdkAppDelegateHandler()

        public override func application(
          _ application: UIApplication,
          didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
        ) -> Bool {
            cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)

          
          // Deep link workaround for app killed state start
          var modifiedLaunchOptions = launchOptions
          if let launchOptions = launchOptions,
             let pushContent = launchOptions[UIApplication.LaunchOptionsKey.remoteNotification] as? [AnyHashable: Any],
             let cio = pushContent["CIO"] as? [String: Any],
             let push = cio["push"] as? [String: Any],
             let link = push["link"] as? String,
             !launchOptions.keys.contains(UIApplication.LaunchOptionsKey.url) {
              
              var mutableLaunchOptions = launchOptions
              mutableLaunchOptions[UIApplication.LaunchOptionsKey.url] = URL(string: link)
              modifiedLaunchOptions = mutableLaunchOptions
          }
          // Deep link workaround for app killed state ends


          return super.application(application, didFinishLaunchingWithOptions: modifiedLaunchOptions)
        }

        // Handle device token registration
        public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
          // Call CustomerIO SDK handler
          cioSdkHandler.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
          super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
        }

        // Handle remote notification registration errors
        public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
          // Call CustomerIO SDK handler
          cioSdkHandler.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
          super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
        }
      }
      "
    `);
  });

  it('is a no-op when CioSdkAppDelegateHandler is already present', () => {
    const alreadyApplied = modifyAppDelegateForPushHandler(
      baseline,
      pushOptions()
    );
    expect(
      modifyAppDelegateForPushHandler(alreadyApplied, pushOptions())
    ).toEqual(alreadyApplied);
  });

  it('is idempotent — applying twice equals applying once', () => {
    const once = modifyAppDelegateForPushHandler(baseline, pushOptions());
    const twice = modifyAppDelegateForPushHandler(once, pushOptions());
    expect(twice).toEqual(once);
  });
});

describe('ios scenarios — modifyAppDelegateForNativeSDKInitializer', () => {
  it('injects CustomerIOSDKInitializer.initialize() before super.application() returns', () => {
    expect(modifyAppDelegateForNativeSDKInitializer(baseline))
      .toMatchInlineSnapshot(`
      "import Expo
      import React

      @UIApplicationMain
      public class AppDelegate: ExpoAppDelegate {
        public override func application(
          _ application: UIApplication,
          didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
        ) -> Bool {
          // Auto Initialize Native Customer.io SDK
          CustomerIOSDKInitializer.initialize()
          return super.application(application, didFinishLaunchingWithOptions: launchOptions)
        }
      }
      "
    `);
  });

  it('is a no-op when the initializer call is already present', () => {
    const alreadyApplied = modifyAppDelegateForNativeSDKInitializer(baseline);
    expect(modifyAppDelegateForNativeSDKInitializer(alreadyApplied)).toEqual(
      alreadyApplied
    );
  });

  it('is idempotent', () => {
    const once = modifyAppDelegateForNativeSDKInitializer(baseline);
    const twice = modifyAppDelegateForNativeSDKInitializer(once);
    expect(twice).toEqual(once);
  });

  // Negative-template: customer customized the AppDelegate so the
  // `return super.application(application, didFinishLaunchingWithOptions:)` anchor
  // is missing. Helper logs a warning and returns content unchanged.
  it('returns content unchanged when the return-super-application anchor is missing', () => {
    const noAnchor = [
      'import Expo',
      '',
      '@UIApplicationMain',
      'public class AppDelegate: ExpoAppDelegate {',
      '  public override func application(',
      '    _ application: UIApplication,',
      '    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil',
      '  ) -> Bool {',
      '    return true',
      '  }',
      '}',
      '',
    ].join('\n');
    expect(modifyAppDelegateForNativeSDKInitializer(noAnchor)).toEqual(
      noAnchor
    );
  });
});
