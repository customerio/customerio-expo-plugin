import * as fs from 'fs';
import * as path from 'path';
import { applyBackgroundPushInfoPlist } from '../../../plugin/src/ios/withBackgroundPushInfoPlist';
import {
  addBackgroundPushHandling,
  modifyAppDelegateForPushHandler,
  patchPushAppDelegateHandler,
  removeBackgroundPushHandling,
} from '../../../plugin/src/ios/withCIOIosSwift';
import type { CustomerIOPluginOptionsIOS } from '../../../plugin/src/types/cio-types';
import { getIosNativeFilesPath } from '../../../plugin/src/utils/plugin';
import { getFixturePath } from '../../utils';

const handlerTemplate = (provider: 'apn' | 'fcm') =>
  fs.readFileSync(
    path.join(
      getIosNativeFilesPath(),
      provider,
      'CioSdkAppDelegateHandler.swift'
    ),
    'utf8'
  );

const pushOptions = (provider: 'apn' | 'fcm'): CustomerIOPluginOptionsIOS =>
  ({
    pushNotification: { provider, appGroupId: 'group.io.customer.test' },
  } as CustomerIOPluginOptionsIOS);

describe.each(['apn', 'fcm'] as const)(
  'ios scenarios — %s CioSdkAppDelegateHandler without background push',
  (provider) => {
    // These snapshots were recorded before background push existed. They must not change: an app
    // that doesn't opt in gets the same generated handler as before.
    it.each([false, true])(
      'is unchanged (autoInitialize: %s)',
      (autoInitialize) => {
        expect(
          patchPushAppDelegateHandler(
            handlerTemplate(provider),
            pushOptions(provider),
            {
              autoInitialize,
            }
          )
        ).toMatchSnapshot();
      }
    );
  }
);

describe.each(['apn', 'fcm'] as const)(
  'ios scenarios — %s CioSdkAppDelegateHandler with background push',
  (provider) => {
    const generated = (autoInitialize: boolean) =>
      patchPushAppDelegateHandler(
        handlerTemplate(provider),
        pushOptions(provider),
        {
          autoInitialize,
          backgroundPush: 'customerio',
        }
      );

    it('adds the silent push method after the APNs registration methods', () => {
      const content = generated(false);
      expect(content).not.toContain('{{BACKGROUND_PUSH_HANDLER}}');
      expect(content).toMatch(
        /didFailToRegisterForRemoteNotificationsWithError: error\)\n {2}\}\n\n {2}\/\/\/ Hands a Customer\.io silent push/
      );
      expect(content).toContain(
        'public func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) -> Bool {'
      );
    });

    it('imports the React Native SDK once', () => {
      for (const autoInitialize of [false, true]) {
        expect(
          generated(autoInitialize).match(/^import customerio_reactnative$/gm)
        ).toHaveLength(1);
      }
    });

    it('changes nothing else in the handler', () => {
      const withoutMethod = (content: string) =>
        content
          .replace(
            /\n {2}\/\/\/ Hands a Customer\.io silent push[\s\S]*?\n {2}\}\n/,
            ''
          )
          .replace(/^import customerio_reactnative\n/m, '');
      for (const autoInitialize of [false, true]) {
        expect(withoutMethod(generated(autoInitialize))).toBe(
          patchPushAppDelegateHandler(
            handlerTemplate(provider),
            pushOptions(provider),
            {
              autoInitialize,
            }
          )
        );
      }
    });
  }
);

describe.each(['apn', 'fcm'] as const)(
  'ios scenarios — %s CioSdkAppDelegateHandler with background push handled by the app',
  (provider) => {
    const generated = (autoInitialize: boolean) =>
      patchPushAppDelegateHandler(
        handlerTemplate(provider),
        pushOptions(provider),
        {
          autoInitialize,
          backgroundPush: 'app',
        }
      );

    it('records Delivered and passes every push on', () => {
      expect(generated(false)).toContain(`-> Void) -> Bool {
    MessagingPush.shared.handleBackgroundPush(userInfo: userInfo)
    return false
  }`);
    });

    it('needs neither the React Native SDK nor a second CioMessagingPush import', () => {
      const content = generated(true);
      expect(content).not.toContain('customerio_reactnative');
      expect(
        content.match(/^(?:@\S+ )?import CioMessagingPush$/gm)
      ).toHaveLength(1);
    });

    it('changes nothing else in the handler', () => {
      const withoutMethod = (content: string) =>
        content
          .replace(
            /\n {2}\/\/\/ Records Delivered for a Customer\.io silent push[\s\S]*?\n {2}\}\n/,
            ''
          )
          .replace(/^import CioMessagingPush\n/m, '');
      for (const autoInitialize of [false, true]) {
        expect(withoutMethod(generated(autoInitialize))).toBe(
          patchPushAppDelegateHandler(
            handlerTemplate(provider),
            pushOptions(provider),
            {
              autoInitialize,
            }
          )
        );
      }
    });
  }
);

describe('ios scenarios — applyBackgroundPushInfoPlist', () => {
  it('adds remote-notification when the app lists no background modes', () => {
    expect(applyBackgroundPushInfoPlist({ CFBundleName: 'App' })).toEqual({
      CFBundleName: 'App',
      UIBackgroundModes: ['remote-notification'],
    });
  });

  it('keeps the modes the app already lists', () => {
    expect(
      applyBackgroundPushInfoPlist({ UIBackgroundModes: ['location', 'fetch'] })
    ).toEqual({
      UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
    });
  });

  it('is idempotent', () => {
    const once = applyBackgroundPushInfoPlist({
      UIBackgroundModes: ['location'],
    });
    expect(
      applyBackgroundPushInfoPlist({
        UIBackgroundModes: [...(once.UIBackgroundModes as string[])],
      })
    ).toEqual(once);
  });
});

describe('ios scenarios — AppDelegate background push routing', () => {
  const sdk55 = fs.readFileSync(
    getFixturePath('ios', 'AppDelegate.sdk55.swift'),
    'utf8'
  );
  const apn = pushOptions('apn');
  const integrated = modifyAppDelegateForPushHandler(sdk55, apn);

  it('adds an override that asks the handler first and passes other pushes to Expo', () => {
    const next = modifyAppDelegateForPushHandler(sdk55, apn, false, true);
    expect(
      next.replace(
        integrated.replace(/\n}\n\nclass ReactNativeDelegate[\s\S]*$/, ''),
        ''
      )
    ).toMatchInlineSnapshot(`
      "

        // Show remote notifications to the Customer.io SDK first; it passes on every push it doesn't take
        public override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
          // Call CustomerIO SDK handler
          if cioSdkHandler.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler) { return }
          super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
        }
      }

      class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
        // Extension point for config-plugins

        override func sourceURL(for bridge: RCTBridge) -> URL? {
          // needed to return the correct URL for expo-dev-client.
          bridge.bundleURL ?? bundleURL()
        }

        override func bundleURL() -> URL? {
      #if DEBUG
          return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
      #else
          return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
      #endif
        }
      }
      "
    `);
  });

  it('puts the guard first in an implementation the app already has', () => {
    const existing = sdk55.replace(
      /\n}\n\nclass ReactNativeDelegate/,
      `
  override func application(
    _ app: UIApplication,
    didReceiveRemoteNotification payload: [AnyHashable: Any],
    fetchCompletionHandler done: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    super.application(app, didReceiveRemoteNotification: payload, fetchCompletionHandler: done)
  }
}

class ReactNativeDelegate`
    );
    const next = modifyAppDelegateForPushHandler(existing, apn, false, true);
    expect(next)
      .toContain(`    fetchCompletionHandler done: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // Call CustomerIO SDK handler
    if cioSdkHandler.application(app, didReceiveRemoteNotification: payload, fetchCompletionHandler: done) { return }
    super.application(app, didReceiveRemoteNotification: payload, fetchCompletionHandler: done)
  }`);
    expect(next).not.toContain(
      'Show remote notifications to the Customer.io SDK first'
    );
    expect(modifyAppDelegateForPushHandler(next, apn, false, false)).toBe(
      modifyAppDelegateForPushHandler(existing, apn)
    );
  });

  it.each([false, true])(
    'is idempotent on a re-prebuild (scene lifecycle: %s)',
    (usesSceneLifecycle) => {
      const source = usesSceneLifecycle
        ? fs.readFileSync(
            getFixturePath('ios', 'AppDelegate.sdk58.swift'),
            'utf8'
          )
        : sdk55;
      const once = modifyAppDelegateForPushHandler(
        source,
        apn,
        usesSceneLifecycle,
        true
      );
      expect(
        modifyAppDelegateForPushHandler(once, apn, usesSceneLifecycle, true)
      ).toBe(once);
    }
  );

  it('turning it off on a re-prebuild restores the AppDelegate without it', () => {
    const on = modifyAppDelegateForPushHandler(sdk55, apn, false, true);
    expect(modifyAppDelegateForPushHandler(on, apn, false, false)).toBe(
      integrated
    );
  });

  it('turning it on over an AppDelegate integrated without it adds only the override', () => {
    expect(modifyAppDelegateForPushHandler(integrated, apn, false, true)).toBe(
      modifyAppDelegateForPushHandler(sdk55, apn, false, true)
    );
  });

  it('puts the guard in an implementation that lives in an AppDelegate extension', () => {
    const existing = `${sdk55}
extension AppDelegate {
  override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
  }
}
`;
    const next = modifyAppDelegateForPushHandler(existing, apn, false, true);
    expect(next.match(/didReceiveRemoteNotification userInfo/g)).toHaveLength(
      1
    );
    expect(next)
      .toContain(`fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    // Call CustomerIO SDK handler
    if cioSdkHandler.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler) { return }
    super.application(`);
    expect(modifyAppDelegateForPushHandler(next, apn, false, true)).toBe(next);
    expect(modifyAppDelegateForPushHandler(next, apn, false, false)).toBe(
      modifyAppDelegateForPushHandler(existing, apn)
    );
  });

  describe('with a type nested in AppDelegate that implements the same callback', () => {
    const callback = (indent: string) =>
      `${indent}func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
${indent}  completionHandler(.noData)
${indent}}`;
    const nestedExtension = `
extension AppDelegate {
  class Helper: NSObject {}
}

extension AppDelegate.Helper {
${callback('  ')}
}
`;
    const helperUntouched = (next: string) =>
      expect(next.slice(next.indexOf('extension AppDelegate.Helper'))).toBe(
        nestedExtension.slice(nestedExtension.indexOf('extension AppDelegate.Helper'))
      );

    it('puts the guard in the real AppDelegate extension, not the nested type', () => {
      const realExtension = `
extension AppDelegate {
  override ${callback('  ').trimStart()}
}
`;
      const existing = `${integrated}${nestedExtension.replace(
        '\nextension AppDelegate.Helper',
        `${realExtension}\nextension AppDelegate.Helper`
      )}`;
      const next = addBackgroundPushHandling(existing);
      helperUntouched(next);
      expect(next).not.toContain('Show remote notifications to the Customer.io SDK first');
      expect(next).toContain(`fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    // Call CustomerIO SDK handler
    if cioSdkHandler.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler) { return }
    completionHandler(.noData)
  }
}

extension AppDelegate.Helper {`);
      expect(removeBackgroundPushHandling(next)).toBe(existing);
    });

    it('adds the override to AppDelegate when only the nested type has the callback', () => {
      const existing = `${integrated}${nestedExtension}`;
      const next = addBackgroundPushHandling(existing);
      helperUntouched(next);
      expect(next).toContain('Show remote notifications to the Customer.io SDK first');
      expect(next.indexOf('Show remote notifications')).toBeLessThan(
        next.indexOf('class ReactNativeDelegate')
      );
      expect(removeBackgroundPushHandling(next)).toBe(existing);
    });

    it('adds the override to AppDelegate when the nested type is declared inside the class', () => {
      const existing = integrated.replace(
        '  let cioSdkHandler = CioSdkAppDelegateHandler()\n',
        `  let cioSdkHandler = CioSdkAppDelegateHandler()\n\n  class Helper: NSObject {\n${callback('    ')}\n  }\n`
      );
      const next = addBackgroundPushHandling(existing);
      expect(next).toContain(`  class Helper: NSObject {\n${callback('    ')}\n  }\n`);
      expect(next).toContain('Show remote notifications to the Customer.io SDK first');
      expect(removeBackgroundPushHandling(next)).toBe(existing);
    });
  });

  it('keeps the guard on its own line when the existing body is on the signature line', () => {
    const existing = sdk55.replace(
      /\n}\n\nclass ReactNativeDelegate/,
      `
  override func application(_ app: UIApplication, didReceiveRemoteNotification payload: [AnyHashable: Any], fetchCompletionHandler done: @escaping (UIBackgroundFetchResult) -> Void) { done(.noData) }
}

class ReactNativeDelegate`
    );
    const next = modifyAppDelegateForPushHandler(existing, apn, false, true);
    expect(next).toContain(
      '-> Void) {\n    // Call CustomerIO SDK handler\n    if cioSdkHandler.application(app, didReceiveRemoteNotification: payload, fetchCompletionHandler: done) { return }\n done(.noData) }'
    );
    expect(modifyAppDelegateForPushHandler(next, apn, false, false)).toContain(
      '-> Void) {\n done(.noData) }'
    );
  });

  it('ignores the same callback in another class of the file', () => {
    const helper = `class PushRelay: NSObject, UIApplicationDelegate {
  func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    completionHandler(.noData)
  }
}

`;
    const withHelper = integrated.replace('@main\n', `${helper}@main\n`);
    const next = addBackgroundPushHandling(withHelper);
    expect(
      next.startsWith(withHelper.slice(0, withHelper.indexOf('@main')))
    ).toBe(true);
    expect(next).toContain(
      'Show remote notifications to the Customer.io SDK first'
    );
    expect(removeBackgroundPushHandling(next)).toBe(withHelper);
  });

  it('adds the override inside the AppDelegate when a comment above it has a closing brace', () => {
    const commented = integrated.replace(
      '@main\n',
      '/*\n Example:\n func f() {\n}\n*/\n@main\n'
    );
    const next = addBackgroundPushHandling(commented);
    expect(next.slice(0, next.indexOf('@main'))).toBe(
      commented.slice(0, commented.indexOf('@main'))
    );
    expect(next).toMatch(
      /fetchCompletionHandler: completionHandler\)\n {2}\}\n\}\n\nclass ReactNativeDelegate/
    );
  });

  it('ignores a mention in a comment', () => {
    const commented = integrated.replace(
      'let cioSdkHandler = CioSdkAppDelegateHandler()',
      'let cioSdkHandler = CioSdkAppDelegateHandler()\n  // cioSdkHandler.application(application, didReceiveRemoteNotification: userInfo, ...)'
    );
    expect(addBackgroundPushHandling(commented)).toContain(
      'Show remote notifications to the Customer.io SDK first'
    );
    expect(removeBackgroundPushHandling(commented)).toBe(commented);
  });
});
