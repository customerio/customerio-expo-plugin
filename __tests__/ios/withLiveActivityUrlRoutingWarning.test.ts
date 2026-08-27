import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  hasExpoRouterNativeIntent,
  withLiveActivityUrlRoutingWarning,
} from '../../plugin/src/ios/withLiveActivityUrlRoutingWarning';
import { logger } from '../../plugin/src/utils/logger';

let projectRoot = '';

jest.mock('@expo/config-plugins', () => ({
  withDangerousMod: (
    config: object,
    [_platform, callback]: [string, (modConfig: object) => object]
  ) => {
    callback({ modRequest: { projectRoot } });
    return config;
  },
}));

jest.mock('../../plugin/src/utils/logger', () => ({
  logger: { warn: jest.fn() },
}));

describe('Expo scene Live Activity URL routing warning', () => {
  beforeEach(() => {
    projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'cio-expo-native-intent-')
    );
    jest.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it.each(['app/+native-intent.tsx', 'src/app/+native-intent.js'])(
    'detects %s as the Expo Router transformation point',
    (relativePath) => {
      const nativeIntentPath = path.join(projectRoot, relativePath);
      fs.mkdirSync(path.dirname(nativeIntentPath), { recursive: true });
      fs.writeFileSync(
        nativeIntentPath,
        `import { CustomerIO } from 'customerio-reactnative';
export function redirectSystemPath({ path }: { path: string }) {
  return CustomerIO.liveActivities.handleWidgetUrl(path);
}`
      );

      expect(hasExpoRouterNativeIntent(projectRoot)).toBe(true);
      withLiveActivityUrlRoutingWarning({ name: 'Test', slug: 'test' });
      expect(logger.warn).not.toHaveBeenCalled();
    }
  );

  it('warns when the app has no native-intent routing point', () => {
    expect(hasExpoRouterNativeIntent(projectRoot)).toBe(false);

    withLiveActivityUrlRoutingWarning({ name: 'Test', slug: 'test' });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('CustomerIO.liveActivities.handleWidgetUrl')
    );
  });

  it('warns when native-intent does not process Live Activity URLs', () => {
    const nativeIntentPath = path.join(projectRoot, 'app/+native-intent.tsx');
    fs.mkdirSync(path.dirname(nativeIntentPath), { recursive: true });
    fs.writeFileSync(
      nativeIntentPath,
      'export function redirectSystemPath({ path }: { path: string }) { return path; }'
    );

    expect(hasExpoRouterNativeIntent(projectRoot)).toBe(false);

    withLiveActivityUrlRoutingWarning({ name: 'Test', slug: 'test' });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('CustomerIO.liveActivities.handleWidgetUrl')
    );
  });
});
