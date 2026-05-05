jest.mock('../../../plugin/src/helpers/constants/ios', () => ({
  getRelativePathToRNSDK: () => '../node_modules/customerio-reactnative',
}));

import { appendNotificationTargetToPodfile } from '../../../plugin/src/helpers/utils/injectCIOPodfileCode';

const IOS_PATH = '/fake/project/ios';

const baseline = [
  "platform :ios, '13.0'",
  "target 'TestApp' do",
  '  use_expo_modules!',
  'end',
  '',
  'post_install do |installer|',
  '  react_native_post_install(installer)',
  'end',
  '',
].join('\n');

describe('ios scenarios — appendNotificationTargetToPodfile', () => {
  it('appends the apn notification target block with use_frameworks: static', () => {
    expect(
      appendNotificationTargetToPodfile(baseline, IOS_PATH, false, 'static')
    ).toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
      end

      post_install do |installer|
        react_native_post_install(installer)
      end
      # --- CustomerIO Notification START ---
      target 'NotificationService' do
        use_frameworks! :linkage => :static
        pod 'customerio-reactnative-richpush/apn', :path => '../node_modules/customerio-reactnative'
      end
      # --- CustomerIO Notification END ---"
    `);
  });

  it('appends the fcm notification target block with use_frameworks: static', () => {
    expect(
      appendNotificationTargetToPodfile(baseline, IOS_PATH, true, 'static')
    ).toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
      end

      post_install do |installer|
        react_native_post_install(installer)
      end
      # --- CustomerIO Notification START ---
      target 'NotificationService' do
        use_frameworks! :linkage => :static
        pod 'customerio-reactnative-richpush/fcm', :path => '../node_modules/customerio-reactnative'
      end
      # --- CustomerIO Notification END ---"
    `);
  });

  it('omits the use_frameworks line when useFrameworks is undefined', () => {
    expect(
      appendNotificationTargetToPodfile(baseline, IOS_PATH, true, undefined)
    ).toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
      end

      post_install do |installer|
        react_native_post_install(installer)
      end
      # --- CustomerIO Notification START ---
      target 'NotificationService' do
        
        pod 'customerio-reactnative-richpush/fcm', :path => '../node_modules/customerio-reactnative'
      end
      # --- CustomerIO Notification END ---"
    `);
  });

  it('is a no-op when the notification target block is already present', () => {
    const once = appendNotificationTargetToPodfile(
      baseline,
      IOS_PATH,
      false,
      'static'
    );
    expect(
      appendNotificationTargetToPodfile(once, IOS_PATH, false, 'static')
    ).toEqual(once);
  });

  it('is idempotent', () => {
    const once = appendNotificationTargetToPodfile(
      baseline,
      IOS_PATH,
      false,
      'static'
    );
    const twice = appendNotificationTargetToPodfile(
      once,
      IOS_PATH,
      false,
      'static'
    );
    expect(twice).toEqual(once);
  });
});
