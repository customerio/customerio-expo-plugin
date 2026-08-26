import type { ExpoConfig } from '@expo/config-types';

let mockExistingTarget: object | null = null;

jest.mock('@expo/config-plugins', () => ({
  withXcodeProject: (
    _config: ExpoConfig,
    callback: (config: Record<string, unknown>) => unknown
  ) =>
    callback({
      modResults: {
        pbxTargetByName: jest.fn((name: string) =>
          name === '"CIOLiveActivityWidget"' ? mockExistingTarget : null
        ),
      },
    }),
}));

jest.mock('../../plugin/src/helpers/utils/injectCIOPodfileCode', () => ({
  injectCIOLiveActivityWidgetPodfileCode: jest.fn(),
}));

import { withCioLiveActivityDisableGuard } from '../../plugin/src/ios/withCioLiveActivityWidgetXcodeProject';

const config = { name: 'Test App', slug: 'test-app' } as ExpoConfig;

describe('withCioLiveActivityDisableGuard', () => {
  beforeEach(() => {
    mockExistingTarget = null;
  });

  it('allows a clean project with no generated widget target', () => {
    expect(() => withCioLiveActivityDisableGuard(config)).not.toThrow();
  });

  it('requires a clean prebuild when the generated widget target exists', () => {
    mockExistingTarget = { name: 'CIOLiveActivityWidget' };

    expect(() => withCioLiveActivityDisableGuard(config)).toThrow(
      'npx expo prebuild --clean --platform ios'
    );
  });
});
