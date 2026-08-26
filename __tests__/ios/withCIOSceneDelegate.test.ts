import * as fs from 'fs';
import { modifySceneDelegateForCustomerIO } from '../../plugin/src/ios/withCIOSceneDelegate';
import { getFixturePath } from '../utils';

const baseline = fs.readFileSync(
  getFixturePath('ios', 'SceneDelegate.sdk58.swift'),
  'utf8'
);
const LIVE_ACTIVITY_CALL =
  'NativeCustomerIO.handleLiveActivityWidgetUrl';

describe('modifySceneDelegateForCustomerIO', () => {
  it('does nothing when no scene integration is enabled', () => {
    expect(
      modifySceneDelegateForCustomerIO(baseline, {
        liveNotificationsEnabled: false,
      })
    ).toBe(baseline);
  });

  it('removes the generated transform when Live Notifications is disabled', () => {
    const enabled = modifySceneDelegateForCustomerIO(baseline, {
      liveNotificationsEnabled: true,
    });
    const disabled = modifySceneDelegateForCustomerIO(enabled, {
      liveNotificationsEnabled: false,
    });

    expect(disabled).not.toContain(LIVE_ACTIVITY_CALL);
    expect(disabled).not.toContain('override func transformURL');
    // Import ownership is unknown, so leave the harmless import in place.
    expect(disabled).toContain('import customerio_reactnative');
  });

  it('preserves a host-owned React Native import when Live Notifications is disabled', () => {
    const customized = `import customerio_reactnative\n${baseline}`.replace(
      '  // Extension point for config plugins.',
      '  let customerOwnedType = NativeCustomerIO.self'
    );
    const enabled = modifySceneDelegateForCustomerIO(customized, {
      liveNotificationsEnabled: true,
    });
    const disabled = modifySceneDelegateForCustomerIO(enabled, {
      liveNotificationsEnabled: false,
    });

    expect(disabled).toContain('import customerio_reactnative');
    expect(disabled).toContain('let customerOwnedType = NativeCustomerIO.self');
    expect(disabled).not.toContain(LIVE_ACTIVITY_CALL);
  });

  it('routes warm and cold Live Activity URLs through the Expo scene hook', () => {
    const output = modifySceneDelegateForCustomerIO(baseline, {
      liveNotificationsEnabled: true,
    });

    expect(output).toContain('import customerio_reactnative');
    expect(output).toContain('override func transformURL(_ url: URL) -> URL?');
    expect(output).toContain(
      'NativeCustomerIO.handleLiveActivityWidgetUrl(url)'
    );
    expect(output).not.toContain('connectionOptions.notificationResponse');
  });

  it('adds the React Native import outside a host-owned conditional block', () => {
    const customized = baseline.replace(
      'internal import Expo',
      `internal import Expo
#if canImport(EXNotifications)
import EXNotifications
#endif`
    );
    const output = modifySceneDelegateForCustomerIO(customized, {
      liveNotificationsEnabled: true,
    });
    const conditionalStart = output.indexOf('#if canImport(EXNotifications)');
    const conditionalEnd = output.indexOf('#endif', conditionalStart);
    const conditionalBlock = output.slice(conditionalStart, conditionalEnd);

    expect(output.indexOf('import customerio_reactnative')).toBeLessThan(
      conditionalStart
    );
    expect(conditionalBlock).not.toContain('import customerio_reactnative');
  });

  it('adds an unconditional import when the host imports React Native only conditionally', () => {
    const customized = baseline.replace(
      'internal import Expo',
      `internal import Expo
#if DEBUG
import customerio_reactnative
#endif`
    );
    const output = modifySceneDelegateForCustomerIO(customized, {
      liveNotificationsEnabled: true,
    });
    const conditionalStart = output.indexOf('#if DEBUG');

    expect(output.indexOf('import customerio_reactnative')).toBeLessThan(
      conditionalStart
    );
    expect(
      (output.match(/^import customerio_reactnative$/gm) ?? []).length
    ).toBe(2);
  });

  it('is idempotent and preserves custom SceneDelegate code', () => {
    const customized = baseline.replace(
      '  // Extension point for config plugins.',
      '  let customerOwnedValue = true'
    );
    const options = {
      liveNotificationsEnabled: true,
    };
    const once = modifySceneDelegateForCustomerIO(customized, options);
    const twice = modifySceneDelegateForCustomerIO(once, options);

    expect(twice).toBe(once);
    expect(twice).toContain('let customerOwnedValue = true');
    expect(
      (twice.match(/NativeCustomerIO\.handleLiveActivityWidgetUrl/g) ?? [])
        .length
    ).toBe(1);
  });

  it('removes a formatted generated transform when Live Notifications is disabled', () => {
    const enabled = modifySceneDelegateForCustomerIO(baseline, {
      liveNotificationsEnabled: true,
    }).replace(
      'NativeCustomerIO.handleLiveActivityWidgetUrl(url)',
      'return NativeCustomerIO.handleLiveActivityWidgetUrl(url)'
    );

    const disabled = modifySceneDelegateForCustomerIO(enabled, {
      liveNotificationsEnabled: false,
    });

    expect(disabled).not.toContain(LIVE_ACTIVITY_CALL);
    expect(disabled).not.toContain('override func transformURL');
  });

  it('does not mistake comments or similarly named methods for a URL transform', () => {
    const customized = baseline.replace(
      '  // Extension point for config plugins.',
      `  // TODO: consider override func transformURL later
  func transformURLForAnalytics(_ url: URL) -> URL { url }`
    );

    const output = modifySceneDelegateForCustomerIO(customized, {
      liveNotificationsEnabled: true,
    });

    expect(output).toContain(LIVE_ACTIVITY_CALL);
    expect(output).toContain('func transformURLForAnalytics');
  });

  it('does not treat a comment containing the Customer.io helper as an installed transform', () => {
    const customized = baseline.replace(
      '  // Extension point for config plugins.',
      `  // NativeCustomerIO.handleLiveActivityWidgetUrl(url)
  let customerOwnedValue = true`
    );

    const output = modifySceneDelegateForCustomerIO(customized, {
      liveNotificationsEnabled: true,
    });

    expect(output).toContain('override func transformURL(_ url: URL) -> URL?');
    expect(output).toContain('let customerOwnedValue = true');
  });

  it('does not treat a block-commented generated transform as installed', () => {
    const customized = baseline.replace(
      '  // Extension point for config plugins.',
      `  /*
  override func transformURL(_ url: URL) -> URL? {
    NativeCustomerIO.handleLiveActivityWidgetUrl(url)
  }
  */`
    );

    const output = modifySceneDelegateForCustomerIO(customized, {
      liveNotificationsEnabled: true,
    });

    expect(
      output.match(/override func transformURL\(_ url: URL\) -> URL\?/g)
    ).toHaveLength(2);
  });

  it('does not treat a generated transform inside a multiline string as installed', () => {
    const customized = baseline.replace(
      '  // Extension point for config plugins.',
      `  let debugText = """
  override func transformURL(_ url: URL) -> URL? {
    NativeCustomerIO.handleLiveActivityWidgetUrl(url)
  }
  """`
    );

    const output = modifySceneDelegateForCustomerIO(customized, {
      liveNotificationsEnabled: true,
    });

    expect(
      output.match(/override func transformURL\(_ url: URL\) -> URL\?/g)
    ).toHaveLength(2);
  });

  it('leaves an existing URL transform untouched', () => {
    const customized = baseline.replace(
      '  // Extension point for config plugins.',
      `  override func transformURL(_ incomingURL: URL) -> URL? {
    if ExistingPlugin.shouldConsume(incomingURL) { nil } else { incomingURL }
  }`
    );

    expect(
      modifySceneDelegateForCustomerIO(customized, {
        liveNotificationsEnabled: true,
      })
    ).toBe(customized);
  });

  it('does not edit a custom scene delegate with a different base class', () => {
    const customSceneDelegate = baseline.replace(
      'class SceneDelegate: ExpoAppSceneDelegate',
      'class SceneDelegate: UIResponder, UIWindowSceneDelegate'
    );

    expect(
      modifySceneDelegateForCustomerIO(customSceneDelegate, {
        liveNotificationsEnabled: true,
      })
    ).toBe(customSceneDelegate);
  });

  it('does not treat a commented Expo scene delegate as the active class', () => {
    const customSceneDelegate = `internal import Expo

/*
class SceneDelegate: ExpoAppSceneDelegate {
}
*/
@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
}
`;

    expect(
      modifySceneDelegateForCustomerIO(customSceneDelegate, {
        liveNotificationsEnabled: true,
      })
    ).toBe(customSceneDelegate);
  });

  it('does not add a duplicate method when an unfamiliar transform signature exists', () => {
    const customized = baseline.replace(
      '  // Extension point for config plugins.',
      `  override func transformURL(_ incomingURL: URL) -> URL! {
    ExistingPlugin.transform(incomingURL)
  }`
    );
    const output = modifySceneDelegateForCustomerIO(customized, {
      liveNotificationsEnabled: true,
    });

    expect((output.match(/func transformURL/g) ?? []).length).toBe(1);
    expect(output).not.toContain(LIVE_ACTIVITY_CALL);
  });

  it('accepts harmless formatting differences in the generated class declaration', () => {
    const reformatted = baseline.replace(
      'class SceneDelegate: ExpoAppSceneDelegate {',
      'class  SceneDelegate : ExpoAppSceneDelegate  {'
    );
    const output = modifySceneDelegateForCustomerIO(reformatted, {
      liveNotificationsEnabled: true,
    });

    expect(output).toContain(LIVE_ACTIVITY_CALL);
  });

  it('accepts an Expo scene delegate that also conforms to a protocol', () => {
    const customized = baseline.replace(
      'class SceneDelegate: ExpoAppSceneDelegate {',
      'class SceneDelegate: ExpoAppSceneDelegate, CustomerSceneProtocol {'
    );
    const output = modifySceneDelegateForCustomerIO(customized, {
      liveNotificationsEnabled: true,
    });

    expect(output).toContain(LIVE_ACTIVITY_CALL);
  });

  it('accepts a multiline Expo scene inheritance list', () => {
    const customized = baseline.replace(
      'class SceneDelegate: ExpoAppSceneDelegate {',
      `class SceneDelegate: ExpoAppSceneDelegate,
  CustomerSceneProtocol {`
    );
    const output = modifySceneDelegateForCustomerIO(customized, {
      liveNotificationsEnabled: true,
    });

    expect(output).toContain(LIVE_ACTIVITY_CALL);
  });
});
