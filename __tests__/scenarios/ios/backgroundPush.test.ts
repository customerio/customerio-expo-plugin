import * as fs from 'fs';
import * as path from 'path';
import { patchPushAppDelegateHandler } from '../../../plugin/src/ios/withCIOIosSwift';
import type { CustomerIOPluginOptionsIOS } from '../../../plugin/src/types/cio-types';
import { getIosNativeFilesPath } from '../../../plugin/src/utils/plugin';

const handlerTemplate = (provider: 'apn' | 'fcm') =>
  fs.readFileSync(
    path.join(getIosNativeFilesPath(), provider, 'CioSdkAppDelegateHandler.swift'),
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
    it.each([false, true])('is unchanged (autoInitialize: %s)', (autoInitialize) => {
      expect(
        patchPushAppDelegateHandler(handlerTemplate(provider), pushOptions(provider), {
          autoInitialize,
        })
      ).toMatchSnapshot();
    });
  }
);
