import type { ExpoConfig } from '@expo/config-types';
import { withCIOIos } from '../../plugin/src/ios/withCIOIos';
import type { CustomerIOPluginLocationOptions } from '../../plugin/src/types/cio-types';

const mockWithCioXcodeProject = jest.fn((config: ExpoConfig, _props?: object) => config);
const mockWithCIOIosSwift = jest.fn((config: ExpoConfig) => config);
const mockWithAppDelegateModifications = jest.fn((config: ExpoConfig) => config);
const mockWithCioNotificationsXcodeProject = jest.fn((config: ExpoConfig) => config);
const mockWithGoogleServicesJsonFile = jest.fn((config: ExpoConfig) => config);

jest.mock('../../plugin/src/ios/withXcodeProject', () => ({
  withCioXcodeProject: (config: ExpoConfig, props?: object) =>
    mockWithCioXcodeProject(config, props),
}));
jest.mock('../../plugin/src/ios/withCIOIosSwift', () => ({
  withCIOIosSwift: (config: ExpoConfig) => mockWithCIOIosSwift(config),
}));
jest.mock('../../plugin/src/ios/withAppDelegateModifications', () => ({
  withAppDelegateModifications: (config: ExpoConfig) =>
    mockWithAppDelegateModifications(config),
}));
jest.mock('../../plugin/src/ios/withNotificationsXcodeProject', () => ({
  withCioNotificationsXcodeProject: (config: ExpoConfig) =>
    mockWithCioNotificationsXcodeProject(config),
}));
jest.mock('../../plugin/src/ios/withGoogleServicesJsonFile', () => ({
  withGoogleServicesJsonFile: (config: ExpoConfig) =>
    mockWithGoogleServicesJsonFile(config),
}));
jest.mock('../../plugin/src/ios/utils', () => ({
  isExpoVersion53OrHigher: jest.fn(() => true),
}));
jest.mock('../../plugin/src/utils/config', () => ({
  mergeConfigWithEnvValues: jest.fn(),
}));
jest.mock('../../plugin/src/utils/logger', () => ({ logger: { warn: jest.fn() } }));

describe('withCIOIos', () => {
  const mockConfig: ExpoConfig = {
    name: 'Test App',
    slug: 'test-app',
    sdkVersion: '53.0.0',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('location-only (no push, no config)', () => {
    it('calls withCioXcodeProject with location subspec when location.enabled is true', () => {
      const location: CustomerIOPluginLocationOptions = { enabled: true };

      withCIOIos(mockConfig, undefined, undefined, location);

      expect(mockWithCIOIosSwift).not.toHaveBeenCalled();
      expect(mockWithCioNotificationsXcodeProject).not.toHaveBeenCalled();
      expect(mockWithCioXcodeProject).toHaveBeenCalledTimes(1);
      expect(mockWithCioXcodeProject).toHaveBeenCalledWith(mockConfig, {
        podfileOptions: { locationEnabled: true, hasPush: false },
      });
    });

    it('does not call withCioXcodeProject when location.enabled is false', () => {
      const location: CustomerIOPluginLocationOptions = { enabled: false };

      withCIOIos(mockConfig, undefined, undefined, location);

      expect(mockWithCioXcodeProject).not.toHaveBeenCalled();
    });

    it('does not call withCioXcodeProject when location is omitted', () => {
      withCIOIos(mockConfig, undefined, undefined, undefined);

      expect(mockWithCioXcodeProject).not.toHaveBeenCalled();
    });
  });
});
