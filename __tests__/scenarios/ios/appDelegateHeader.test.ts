import * as fs from 'fs';
import { modifyAppDelegateHeader } from '../../../plugin/src/ios/withAppDelegateModifications';
import { getFixturePath } from '../../utils';

const baseline = fs.readFileSync(
  getFixturePath('ios', 'AppDelegate.h'),
  'utf8'
);

describe('ios scenarios — modifyAppDelegateHeader (Obj-C)', () => {
  it('adds UNUserNotificationCenterDelegate to a header with no existing delegates', () => {
    expect(modifyAppDelegateHeader(baseline)).toMatchInlineSnapshot(`
      "#import <Expo/Expo.h>

      #import <UserNotifications/UserNotifications.h>
      @interface AppDelegate : EXAppDelegateWrapper <UNUserNotificationCenterDelegate>
      @end
      "
    `);
  });

  it('appends UNUserNotificationCenterDelegate when other delegates already exist', () => {
    const withOtherDelegate = [
      '#import <Expo/Expo.h>',
      '',
      '@interface AppDelegate : EXAppDelegateWrapper <UIApplicationDelegate>',
      '',
      '@end',
      '',
    ].join('\n');
    expect(modifyAppDelegateHeader(withOtherDelegate)).toMatchInlineSnapshot(`
      "#import <Expo/Expo.h>

      #import <UserNotifications/UserNotifications.h>
      @interface AppDelegate : EXAppDelegateWrapper <UIApplicationDelegate, UNUserNotificationCenterDelegate>


      @end
      "
    `);
  });

  it('is a no-op when UNUserNotificationCenterDelegate is already declared', () => {
    const alreadyHas = [
      '#import <Expo/Expo.h>',
      '#import <UserNotifications/UserNotifications.h>',
      '',
      '@interface AppDelegate : EXAppDelegateWrapper <UNUserNotificationCenterDelegate>',
      '',
      '@end',
      '',
    ].join('\n');
    expect(modifyAppDelegateHeader(alreadyHas)).toEqual(alreadyHas);
  });

  it('is idempotent — applying twice equals applying once', () => {
    const once = modifyAppDelegateHeader(baseline);
    const twice = modifyAppDelegateHeader(once);
    expect(twice).toEqual(once);
  });
});
