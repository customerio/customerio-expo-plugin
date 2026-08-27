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
        pod 'CustomerIOLiveActivitiesTemplates'
        pod 'CustomerIOLiveActivitiesAttributes'
      end
      # --- CustomerIO Live Activity END ---
      "
    `);
  });

  it('preserves the existing extension behavior for dynamic host frameworks', () => {
    expect(
      appendLiveActivityWidgetTargetToPodfile(baseline, 'dynamic')
    ).not.toContain('use_frameworks!');
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
        
        pod 'CustomerIOLiveActivitiesTemplates'
        pod 'CustomerIOLiveActivitiesAttributes'
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

  it('updates linkage in an existing managed block', () => {
    const widgetStatic = appendLiveActivityWidgetTargetToPodfile(
      baseline,
      'static'
    );
    const widgetDynamic = appendLiveActivityWidgetTargetToPodfile(
      widgetStatic,
      'dynamic'
    );
    const widgetWithoutFrameworks = appendLiveActivityWidgetTargetToPodfile(
      widgetDynamic,
      undefined
    );

    expect(widgetDynamic).not.toContain('use_frameworks!');
    expect(widgetWithoutFrameworks).not.toContain('use_frameworks!');
    expect(
      (widgetWithoutFrameworks.match(/CustomerIO Live Activity START/g) ?? [])
        .length
    ).toBe(1);
  });
});
