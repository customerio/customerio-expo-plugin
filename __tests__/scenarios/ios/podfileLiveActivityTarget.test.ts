import { appendLiveActivityWidgetTargetToPodfile } from '../../../plugin/src/helpers/utils/injectCIOPodfileCode';

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

describe('ios scenarios — appendLiveActivityWidgetTargetToPodfile', () => {
  it('appends the widget target block with use_frameworks: static', () => {
    expect(appendLiveActivityWidgetTargetToPodfile(baseline, 'static'))
      .toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
      end

      post_install do |installer|
        react_native_post_install(installer)
      end
      # --- CustomerIO Live Activity START ---
      target 'CIOLiveActivityWidget' do
        use_frameworks! :linkage => :static
        pod 'CustomerIOLiveActivitiesTemplates', :git => 'https://github.com/customerio/customerio-ios.git', :branch => 'feat/live-activities'
        pod 'CustomerIOLiveActivitiesAttributes', :git => 'https://github.com/customerio/customerio-ios.git', :branch => 'feat/live-activities'
      end
      # --- CustomerIO Live Activity END ---
      "
    `);
  });

  it('omits the use_frameworks line when useFrameworks is undefined', () => {
    expect(appendLiveActivityWidgetTargetToPodfile(baseline, undefined))
      .toMatchInlineSnapshot(`
      "platform :ios, '13.0'
      target 'TestApp' do
        use_expo_modules!
      end

      post_install do |installer|
        react_native_post_install(installer)
      end
      # --- CustomerIO Live Activity START ---
      target 'CIOLiveActivityWidget' do
        
        pod 'CustomerIOLiveActivitiesTemplates', :git => 'https://github.com/customerio/customerio-ios.git', :branch => 'feat/live-activities'
        pod 'CustomerIOLiveActivitiesAttributes', :git => 'https://github.com/customerio/customerio-ios.git', :branch => 'feat/live-activities'
      end
      # --- CustomerIO Live Activity END ---
      "
    `);
  });

  it('is a no-op when the widget target block is already present', () => {
    const once = appendLiveActivityWidgetTargetToPodfile(baseline, 'static');
    expect(appendLiveActivityWidgetTargetToPodfile(once, 'static')).toEqual(
      once
    );
  });

  it('is idempotent', () => {
    const once = appendLiveActivityWidgetTargetToPodfile(baseline, 'static');
    const twice = appendLiveActivityWidgetTargetToPodfile(once, 'static');
    expect(twice).toEqual(once);
  });
});
