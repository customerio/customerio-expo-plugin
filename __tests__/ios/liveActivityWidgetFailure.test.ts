import type { ExpoConfig } from '@expo/config-types';

// Invoke the mod's callback directly so the failure inside it surfaces to the caller.
jest.mock('@expo/config-plugins', () => ({
  withXcodeProject: (
    config: Record<string, unknown>,
    callback: (c: Record<string, unknown>) => unknown,
  ) =>
    callback({
      ...config,
      modResults: {},
      modRequest: { projectName: 'TestApp', platformProjectRoot: '/test/ios', projectRoot: '/test' },
    }),
}));

// The first thing the widget injection does is append its Podfile target, so failing it here stands
// in for any runtime failure part-way through building the extension.
jest.mock('../../plugin/src/helpers/utils/injectCIOPodfileCode', () => ({
  injectCIOLiveActivityWidgetPodfileCode: jest.fn(() =>
    Promise.reject(new Error('Podfile not found')),
  ),
}));

import { withCioLiveActivityWidgetXcodeProject } from '../../plugin/src/ios/withCioLiveActivityWidgetXcodeProject';

const config = {
  name: 'Test App',
  slug: 'test-app',
  version: '1.0.0',
  ios: { bundleIdentifier: 'com.test.app' },
} as ExpoConfig;

describe('withCioLiveActivityWidgetXcodeProject failure handling', () => {
  // NSSupportsLiveActivities and the `liveactivities` pod subspec are applied by mods that have
  // already run by this point. Logging and returning the config would leave a project advertising
  // Live Activities support with no extension to render them — configured-looking, permanently
  // silent. Failing the prebuild is what makes the problem visible.
  it('fails the prebuild instead of leaving the app half-configured', async () => {
    await expect(
      withCioLiveActivityWidgetXcodeProject(config, {
        props: { iosPath: '/test/ios' },
        liveNotifications: { types: [] },
      }) as unknown as Promise<unknown>,
    ).rejects.toThrow(/Live Activity widget failed: .*Podfile not found/);
  });
});
