jest.mock('../../../plugin/src/helpers/constants/ios', () => ({
  getRelativePathToRNSDK: () => '../node_modules/customerio-reactnative',
}));

import { injectHostAppPodfileCode } from '../../../plugin/src/helpers/utils/injectCIOPodfileCode';

const IOS_PATH = '/fake/project/ios';

const baseline = [
  "platform :ios, '13.0'",
  "target 'TestApp' do",
  '  use_expo_modules!',
  '  config = use_native_modules!',
  '  use_react_native!(',
  '    :path => config[:reactNativePath],',
  '  )',
  'end',
  '',
  'post_install do |installer|',
  '  react_native_post_install(installer)',
  'end',
  '',
].join('\n');

describe('ios scenarios — injectHostAppPodfileCode', () => {
  it('injects the apn host-app block before post_install (default options)', () => {
    expect(injectHostAppPodfileCode(baseline, IOS_PATH, false))
      .toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
        config = use_native_modules!
        use_react_native!(
          :path => config[:reactNativePath],
        )
      end

      # --- CustomerIO Host App START ---
        pod 'customerio-reactnative/apn', :path => '../node_modules/customerio-reactnative'
      # --- CustomerIO Host App END ---
      post_install do |installer|
        react_native_post_install(installer)
      end
      "
    `);
  });

  it('injects the fcm host-app block before post_install', () => {
    expect(injectHostAppPodfileCode(baseline, IOS_PATH, true))
      .toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
        config = use_native_modules!
        use_react_native!(
          :path => config[:reactNativePath],
        )
      end

      # --- CustomerIO Host App START ---
        pod 'customerio-reactnative/fcm', :path => '../node_modules/customerio-reactnative'
      # --- CustomerIO Host App END ---
      post_install do |installer|
        react_native_post_install(installer)
      end
      "
    `);
  });

  it('injects subspecs (push + location) when locationEnabled and hasPush', () => {
    expect(
      injectHostAppPodfileCode(baseline, IOS_PATH, false, {
        locationEnabled: true,
        hasPush: true,
      })
    ).toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
        config = use_native_modules!
        use_react_native!(
          :path => config[:reactNativePath],
        )
      end

      # --- CustomerIO Host App START ---
        pod 'customerio-reactnative', :subspecs => ['apn', 'location'], :path => '../node_modules/customerio-reactnative'
      # --- CustomerIO Host App END ---
      post_install do |installer|
        react_native_post_install(installer)
      end
      "
    `);
  });

  it('injects only the location subspec when locationEnabled and hasPush is false', () => {
    expect(
      injectHostAppPodfileCode(baseline, IOS_PATH, false, {
        locationEnabled: true,
        hasPush: false,
      })
    ).toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
        config = use_native_modules!
        use_react_native!(
          :path => config[:reactNativePath],
        )
      end

      # --- CustomerIO Host App START ---
        pod 'customerio-reactnative', :subspecs => ['location'], :path => '../node_modules/customerio-reactnative'
      # --- CustomerIO Host App END ---
      post_install do |installer|
        react_native_post_install(installer)
      end
      "
    `);
  });

  it('injects subspecs (push + liveactivities) when liveActivityEnabled and hasPush', () => {
    expect(
      injectHostAppPodfileCode(baseline, IOS_PATH, false, {
        liveActivityEnabled: true,
        hasPush: true,
      })
    ).toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
        config = use_native_modules!
        use_react_native!(
          :path => config[:reactNativePath],
        )
      end

      # --- CustomerIO Host App START ---
        pod 'customerio-reactnative', :subspecs => ['apn', 'liveactivities'], :path => '../node_modules/customerio-reactnative'
      # --- CustomerIO Host App END ---
      post_install do |installer|
        react_native_post_install(installer)
      end
      "
    `);
  });

  it('injects push + location + liveactivities subspecs when all are enabled', () => {
    expect(
      injectHostAppPodfileCode(baseline, IOS_PATH, true, {
        locationEnabled: true,
        hasPush: true,
        liveActivityEnabled: true,
      })
    ).toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
        config = use_native_modules!
        use_react_native!(
          :path => config[:reactNativePath],
        )
      end

      # --- CustomerIO Host App START ---
        pod 'customerio-reactnative', :subspecs => ['fcm', 'location', 'liveactivities'], :path => '../node_modules/customerio-reactnative'
      # --- CustomerIO Host App END ---
      post_install do |installer|
        react_native_post_install(installer)
      end
      "
    `);
  });

  it('is a no-op when the host-app block is already present', () => {
    const once = injectHostAppPodfileCode(baseline, IOS_PATH, false);
    expect(injectHostAppPodfileCode(once, IOS_PATH, false)).toEqual(once);
  });

  it('is idempotent', () => {
    const once = injectHostAppPodfileCode(baseline, IOS_PATH, false);
    const twice = injectHostAppPodfileCode(once, IOS_PATH, false);
    expect(twice).toEqual(once);
  });
});
