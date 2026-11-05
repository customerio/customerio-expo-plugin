import * as fs from 'fs';
import * as path from 'path';
import { PLATFORM } from '../../../plugin/src/helpers/constants/common';
import { ANDROID_BACKGROUND_PUSH_CALLBACK } from '../../../plugin/src/helpers/utils/patchBackgroundPushCode';
import { patchNativeSDKInitializer } from '../../../plugin/src/helpers/utils/patchPluginNativeCode';
import type { NativeSDKConfig } from '../../../plugin/src/types/cio-types';

jest.mock('../../../plugin/src/utils/plugin', () => ({
  getPluginVersion: () => '0.0.0-test',
}));

const nativeFiles = path.join(__dirname, '../../../plugin/src/helpers/native-files');
const kotlinTemplate = fs.readFileSync(
  path.join(nativeFiles, 'android/CustomerIOSDKInitializer.kt'),
  'utf8'
);
const swiftTemplate = fs.readFileSync(
  path.join(nativeFiles, 'ios/CustomerIOSDKInitializer.swift'),
  'utf8'
);

const sdkConfig: NativeSDKConfig = { cdpApiKey: 'cdp-key' };
const withLiveNotifications: NativeSDKConfig = {
  ...sdkConfig,
  liveNotifications: { types: ['io.customer.livenotifications.segments'] },
};

const android = (config: NativeSDKConfig, backgroundPush: boolean) =>
  patchNativeSDKInitializer(
    kotlinTemplate,
    PLATFORM.ANDROID,
    config,
    undefined,
    undefined,
    undefined,
    undefined,
    backgroundPush
  );

/** The push module builder chain, from `ModuleMessagingPushFCM(` to its closing `)`. */
const pushModule = (content: string) =>
  content.match(/ModuleMessagingPushFCM\([\s\S]*?\.build\(\)\n?\s*\)/)?.[0];

describe('android scenarios — background push in CustomerIOSDKInitializer.kt', () => {
  it('leaves the push module on one line when off', () => {
    expect(pushModule(android(sdkConfig, false))).toBe(
      'ModuleMessagingPushFCM(\n                MessagingPushModuleConfig.Builder().build()\n            )'
    );
  });

  it('leaves no placeholder behind in any combination', () => {
    for (const config of [sdkConfig, withLiveNotifications]) {
      for (const enabled of [false, true]) {
        expect(android(config, enabled)).not.toMatch(/\{\{|\}\}/);
      }
    }
  });

  it('registers the callback on the push module config when on', () => {
    const content = android(sdkConfig, true);
    expect(pushModule(content)).toBe(
      'ModuleMessagingPushFCM(\n' +
        '                MessagingPushModuleConfig.Builder()\n' +
        `                    .setBackgroundPushCallback(${ANDROID_BACKGROUND_PUSH_CALLBACK.expression})\n` +
        '                    .build()\n' +
        '            )'
    );
    expect(content.split('\n')).toContain(ANDROID_BACKGROUND_PUSH_CALLBACK.importLine);
  });

  it('keeps the Live Notification setup and adds the callback after it', () => {
    const off = android(withLiveNotifications, false);
    const on = android(withLiveNotifications, true);
    expect(pushModule(on)).toBe(
      pushModule(off)?.replace(
        /\n(\s*)\.build\(\)/,
        `\n$1.setBackgroundPushCallback(${ANDROID_BACKGROUND_PUSH_CALLBACK.expression})\n$1.build()`
      )
    );
  });

  it('changes only the import and the callback line', () => {
    const on = android(sdkConfig, true)
      .replace(`${ANDROID_BACKGROUND_PUSH_CALLBACK.importLine}\n`, '')
      .replace(
        /MessagingPushModuleConfig\.Builder\(\)\n\s*\.setBackgroundPushCallback\([^\n]*\)\n\s*\.build\(\)/,
        'MessagingPushModuleConfig.Builder().build()'
      );
    expect(on).toBe(android(sdkConfig, false));
  });

  it('does not touch the iOS initializer', () => {
    const ios = (backgroundPush: boolean) =>
      patchNativeSDKInitializer(
        swiftTemplate,
        PLATFORM.IOS,
        sdkConfig,
        undefined,
        undefined,
        undefined,
        undefined,
        backgroundPush
      );
    expect(ios(true)).toBe(ios(false));
  });
});
