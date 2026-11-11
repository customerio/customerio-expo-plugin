import * as fs from 'fs';
import * as path from 'path';
import { modifyAppDelegateForPushHandler } from '../../../plugin/src/ios/withCIOIosSwift';
import type { CustomerIOPluginOptionsIOS } from '../../../plugin/src/types/cio-types';
import { logger } from '../../../plugin/src/utils/logger';
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
  // Handle remote notifications, including Customer.io silent pushes
  public override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    // Call CustomerIO SDK handler
    if cioSdkHandler.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler) { return }
    super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
  }
`;
  const integrated = modifyAppDelegateForPushHandler(sdk55, apn);

  it('adds an override that asks the handler first and passes other pushes to Expo', () => {
    expect(integrated).toContain(`${override}}\n\nclass ReactNativeDelegate`);
  });

  it.each([false, true])(
    'adds only the override to an AppDelegate an earlier plugin version integrated (scene lifecycle: %s)',
    (usesSceneLifecycle) => {
      const source = usesSceneLifecycle
        ? fs.readFileSync(getFixturePath('ios', 'AppDelegate.sdk58.swift'), 'utf8')
        : sdk55;
      const current = modifyAppDelegateForPushHandler(source, apn, usesSceneLifecycle);
      const earlier = current.replace(override, '');
      expect(earlier).not.toContain('didReceiveRemoteNotification');
      expect(modifyAppDelegateForPushHandler(earlier, apn, usesSceneLifecycle)).toBe(current);
      expect(modifyAppDelegateForPushHandler(current, apn, usesSceneLifecycle)).toBe(current);
    }
  );

  it('puts the call first in an implementation the app already has', () => {
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

  const withExisting = (implementation: string) =>
    sdk55.replace(
      /\n}\n\nclass ReactNativeDelegate/,
      `\n  ${implementation}\n}\n\nclass ReactNativeDelegate`
    );

  it('ends the call with a line break when the body is on the signature line', () => {
    const next = modifyAppDelegateForPushHandler(
      withExisting(
        'override func application(_ app: UIApplication, didReceiveRemoteNotification payload: [AnyHashable: Any], fetchCompletionHandler done: @escaping (UIBackgroundFetchResult) -> Void) { done(.noData) }'
      ),
      apn
    );
    expect(next).toContain(
      '-> Void) {\n    // Call CustomerIO SDK handler\n    if cioSdkHandler.application(app, didReceiveRemoteNotification: payload, fetchCompletionHandler: done) { return }\n done(.noData) }'
    );
  });

  it.each([
    [
      'an unnamed application parameter',
      'override func application(_: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {\n    completionHandler(.noData)\n  }',
    ],
    [
      'no internal name on fetchCompletionHandler',
      'override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler: @escaping (UIBackgroundFetchResult) -> Void) {\n    fetchCompletionHandler(.noData)\n  }',
    ],
    [
      'the async form',
      'override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {\n    .noData\n  }',
    ],
  ])('warns and adds nothing next to an implementation with %s', (_, implementation) => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const existing = withExisting(implementation);
    const next = modifyAppDelegateForPushHandler(existing, apn);
    expect(next.match(/didReceiveRemoteNotification/g)).toHaveLength(1);
    expect(next).toContain(implementation);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('in a form the plugin cannot add to')
    );
    warn.mockRestore();
  });
});
