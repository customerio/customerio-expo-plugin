import * as fs from 'fs';
import * as path from 'path';
import { getIosNativeFilesPath } from '../../../plugin/src/utils/plugin';

const handlerTemplate = (provider: 'apn' | 'fcm') =>
  fs.readFileSync(
    path.join(getIosNativeFilesPath(), provider, 'CioSdkAppDelegateHandler.swift'),
    'utf8'
  );

/** Returns the trimmed body of the handler's `application(_:<label>:)` method. */
const methodBody = (source: string, label: string) => {
  const match = source.match(
    new RegExp(`func application\\(_ application: UIApplication, ${label} [^)]*\\) \\{([^}]*)\\}`)
  );
  if (!match) {
    throw new Error(`application(_:${label}:) not found`);
  }
  return match[1].trim();
};

// The handler sets `MessagingPush.appDelegateIntegratedExplicitly`, which turns off the SDK's own
// app-delegate swizzling. So the SDK only sees the APNs callbacks the handler forwards, and with
// Firebase's swizzling off (`FirebaseAppDelegateProxyEnabled = NO`) nothing else gives FCM the
// APNs token.
describe.each(['apn', 'fcm'] as const)(
  'ios scenarios — %s CioSdkAppDelegateHandler',
  (provider) => {
    it('forwards the APNs device token to the Customer.io app delegate', () => {
      expect(
        methodBody(
          handlerTemplate(provider),
          'didRegisterForRemoteNotificationsWithDeviceToken'
        )
      ).toBe(
        'cioAppDelegate.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)'
      );
    });

    it('forwards APNs registration failures to the Customer.io app delegate', () => {
      expect(
        methodBody(
          handlerTemplate(provider),
          'didFailToRegisterForRemoteNotificationsWithError'
        )
      ).toBe(
        'cioAppDelegate.application(application, didFailToRegisterForRemoteNotificationsWithError: error)'
      );
    });
  }
);
