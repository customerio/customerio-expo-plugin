import * as fs from 'fs';
import * as path from 'path';
import {
  addDidReceiveRemoteNotification,
  modifyAppDelegateForPushHandler,
} from '../../../plugin/src/ios/withCIOIosSwift';
import type { CustomerIOPluginOptionsIOS } from '../../../plugin/src/types/cio-types';
import { getIosNativeFilesPath } from '../../../plugin/src/utils/plugin';
import { getFixturePath } from '../../utils';

describe.each(['apn', 'fcm'] as const)(
  'ios scenarios — %s CioSdkAppDelegateHandler silent push',
  (provider) => {
    const template = fs.readFileSync(
      path.join(getIosNativeFilesPath(), provider, 'CioSdkAppDelegateHandler.swift'),
      'utf8'
    );

    it('offers a silent push to the React Native SDK the way CioAppDelegateWrapper does', () => {
      expect(template).toMatch(/^@_spi\(Internal\) import CioMessagingPush$/m);
      expect(template).toContain(`-> Void) -> Bool {
    guard case .received(let push) = MessagingPush.shared.handleBackgroundPush(userInfo: userInfo),
          let reactNativeHandler = MessagingPush.wrapperBackgroundPushHandler
    else { return false }
    return reactNativeHandler(push, completionHandler)
  }`);
    });
  }
);

describe('ios scenarios — AppDelegate didReceiveRemoteNotification', () => {
  const sdk55 = fs.readFileSync(getFixturePath('ios', 'AppDelegate.sdk55.swift'), 'utf8');
  const apn = { pushNotification: { provider: 'apn' } } as CustomerIOPluginOptionsIOS;
  const override = `
  // Show remote notifications to the Customer.io SDK first; it passes on every push it doesn't take
  public override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    // Call CustomerIO SDK handler
    if cioSdkHandler.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler) { return }
    super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
  }
`;
  const integrated = modifyAppDelegateForPushHandler(sdk55, apn);
  // What an earlier plugin version generated: everything but this hook.
  const withoutHook = integrated.replace(override, '');
  const callback = (indent: string) =>
    `${indent}func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
${indent}  completionHandler(.noData)
${indent}}`;

  it('adds an override that asks the handler first and passes other pushes to Expo', () => {
    expect(integrated).toContain(`${override}}\n\nclass ReactNativeDelegate`);
    expect(withoutHook).not.toContain('didReceiveRemoteNotification');
  });

  it('adds only the override to an AppDelegate an earlier plugin version integrated', () => {
    expect(modifyAppDelegateForPushHandler(withoutHook, apn)).toBe(integrated);
  });

  it.each([false, true])('is idempotent (scene lifecycle: %s)', (usesSceneLifecycle) => {
    const source = usesSceneLifecycle
      ? fs.readFileSync(getFixturePath('ios', 'AppDelegate.sdk58.swift'), 'utf8')
      : sdk55;
    const once = modifyAppDelegateForPushHandler(source, apn, usesSceneLifecycle);
    expect(once).toContain(override);
    expect(modifyAppDelegateForPushHandler(once, apn, usesSceneLifecycle)).toBe(once);
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
    const next = modifyAppDelegateForPushHandler(existing, apn);
    expect(next).toContain(`    fetchCompletionHandler done: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // Call CustomerIO SDK handler
    if cioSdkHandler.application(app, didReceiveRemoteNotification: payload, fetchCompletionHandler: done) { return }
    super.application(app, didReceiveRemoteNotification: payload, fetchCompletionHandler: done)
  }`);
    expect(next).not.toContain(override);
  });

  it('keeps the guard on its own line when the existing body is on the signature line', () => {
    const existing = sdk55.replace(
      /\n}\n\nclass ReactNativeDelegate/,
      `
  override func application(_ app: UIApplication, didReceiveRemoteNotification payload: [AnyHashable: Any], fetchCompletionHandler done: @escaping (UIBackgroundFetchResult) -> Void) { done(.noData) }
}

class ReactNativeDelegate`
    );
    expect(modifyAppDelegateForPushHandler(existing, apn)).toContain(
      '-> Void) {\n    // Call CustomerIO SDK handler\n    if cioSdkHandler.application(app, didReceiveRemoteNotification: payload, fetchCompletionHandler: done) { return }\n done(.noData) }'
    );
  });

  it('adds no second implementation next to one with unnamed parameters', () => {
    const existing = sdk55.replace(
      /\n}\n\nclass ReactNativeDelegate/,
      `
  override func application(_: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    completionHandler(.noData)
  }
}

class ReactNativeDelegate`
    );
    const next = modifyAppDelegateForPushHandler(existing, apn);
    expect(next.match(/didReceiveRemoteNotification userInfo/g)).toHaveLength(1);
    expect(next).not.toContain('cioSdkHandler.application(application, didReceiveRemoteNotification');
  });

  it('puts the guard in an implementation in an AppDelegate extension', () => {
    const existing = `${withoutHook}
extension AppDelegate {
  override ${callback('  ').trimStart()}
}
`;
    const next = addDidReceiveRemoteNotification(existing);
    expect(next.match(/didReceiveRemoteNotification userInfo/g)).toHaveLength(1);
    expect(next).toContain(`-> Void) {
    // Call CustomerIO SDK handler
    if cioSdkHandler.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler) { return }
    completionHandler(.noData)
  }
}
`);
  });

  describe('with a type nested in AppDelegate that implements the same callback', () => {
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
      const existing = `${withoutHook}${nestedExtension.replace(
        '\nextension AppDelegate.Helper',
        `\nextension AppDelegate {\n  override ${callback('  ').trimStart()}\n}\n\nextension AppDelegate.Helper`
      )}`;
      const next = addDidReceiveRemoteNotification(existing);
      helperUntouched(next);
      expect(next).not.toContain(override);
      expect(next).toContain(`    if cioSdkHandler.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler) { return }
    completionHandler(.noData)
  }
}

extension AppDelegate.Helper {`);
    });

    it('adds the override to AppDelegate when only the nested type has the callback', () => {
      const next = addDidReceiveRemoteNotification(`${withoutHook}${nestedExtension}`);
      helperUntouched(next);
      expect(next).toContain(`${override}}\n\nclass ReactNativeDelegate`);
    });

    it('adds the override to AppDelegate when the nested type is declared inside the class', () => {
      const nestedClass = `  class Helper: NSObject {\n${callback('    ')}\n  }\n`;
      const existing = withoutHook.replace(
        '  let cioSdkHandler = CioSdkAppDelegateHandler()\n',
        `  let cioSdkHandler = CioSdkAppDelegateHandler()\n\n${nestedClass}`
      );
      const next = addDidReceiveRemoteNotification(existing);
      expect(next).toContain(nestedClass);
      expect(next).toContain(`${override}}\n\nclass ReactNativeDelegate`);
    });
  });

  it('ignores the same callback in another class of the file', () => {
    const helper = `class PushRelay: NSObject, UIApplicationDelegate {\n${callback('  ')}\n}\n\n`;
    const next = addDidReceiveRemoteNotification(withoutHook.replace('@main\n', `${helper}@main\n`));
    expect(next.startsWith(withoutHook.slice(0, withoutHook.indexOf('@main')) + helper)).toBe(true);
    expect(next).toContain(`${override}}\n\nclass ReactNativeDelegate`);
  });

  it('adds the override inside the AppDelegate when a comment above it has a closing brace', () => {
    const next = addDidReceiveRemoteNotification(
      withoutHook.replace('@main\n', '/*\n Example:\n func f() {\n}\n*/\n@main\n')
    );
    expect(next).toContain(`${override}}\n\nclass ReactNativeDelegate`);
  });

  it('ignores a mention in a comment', () => {
    const next = addDidReceiveRemoteNotification(
      withoutHook.replace(
        'let cioSdkHandler = CioSdkAppDelegateHandler()',
        'let cioSdkHandler = CioSdkAppDelegateHandler()\n  // cioSdkHandler.application(application, didReceiveRemoteNotification: userInfo, ...)'
      )
    );
    expect(next).toContain(`${override}}\n\nclass ReactNativeDelegate`);
  });
});
