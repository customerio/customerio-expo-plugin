import type { ExpoConfig } from '@expo/config-types';
import { withCIOIos } from '../../plugin/src/ios/withCIOIos';
import type { CustomerIOPluginLocationOptions, CustomerIOPluginOptionsIOS } from '../../plugin/src/types/cio-types';

const mockWithCioXcodeProject = jest.fn((config: ExpoConfig, _props?: object) => config);
const mockWithCIOIosSwift = jest.fn((config: ExpoConfig) => config);
const mockWithAppDelegateModifications = jest.fn((config: ExpoConfig) => config);
const mockWithCioNotificationsXcodeProject = jest.fn((config: ExpoConfig) => config);
const mockWithGoogleServicesJsonFile = jest.fn((config: ExpoConfig) => config);
const mockWithEntitlementsPlist = jest.fn((config: ExpoConfig, callback: (c: unknown) => unknown) => {
  callback({ ios: { bundleIdentifier: 'com.test.app' }, modResults: {} });
  return config;
});

jest.mock('@expo/config-plugins', () => ({
  withEntitlementsPlist: (config: ExpoConfig, callback: (c: unknown) => unknown) =>
    mockWithEntitlementsPlist(config, callback),
}));

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

  describe('host app entitlements when push is enabled', () => {
    const propsWithAppGroup: CustomerIOPluginOptionsIOS = {
      iosPath: '/test/ios',
      pushNotification: {
        provider: 'apn',
        appGroupId: 'group.com.example.app',
      },
    };

    const propsWithoutAppGroup: CustomerIOPluginOptionsIOS = {
      iosPath: '/test/ios',
      pushNotification: {
        provider: 'apn',
      },
    };

    it('calls withEntitlementsPlist when appGroupId is set', () => {
      withCIOIos(mockConfig, undefined, propsWithAppGroup);

      expect(mockWithEntitlementsPlist).toHaveBeenCalledTimes(1);
    });

    it('does NOT call withEntitlementsPlist when appGroupId is not set', () => {
      withCIOIos(mockConfig, undefined, propsWithoutAppGroup);

      expect(mockWithEntitlementsPlist).not.toHaveBeenCalled();
    });

    it('adds appGroupId to com.apple.security.application-groups', () => {
      const modResults: Record<string, unknown> = {};
      mockWithEntitlementsPlist.mockImplementationOnce((config, callback) => {
        callback({ ios: { bundleIdentifier: 'com.example.app' }, modResults });
        return config;
      });

      withCIOIos(mockConfig, undefined, propsWithAppGroup);

      expect(modResults['com.apple.security.application-groups']).toEqual(['group.com.example.app']);
    });

    it('does not duplicate an existing group id', () => {
      const modResults: Record<string, unknown> = {
        'com.apple.security.application-groups': ['group.com.example.app'],
      };
      mockWithEntitlementsPlist.mockImplementationOnce((config, callback) => {
        callback({ ios: { bundleIdentifier: 'com.example.app' }, modResults });
        return config;
      });

      withCIOIos(mockConfig, undefined, propsWithAppGroup);

      expect(modResults['com.apple.security.application-groups']).toEqual(['group.com.example.app']);
    });

    it('appends new group id while preserving existing ones', () => {
      const modResults: Record<string, unknown> = {
        'com.apple.security.application-groups': ['group.other.app'],
      };
      mockWithEntitlementsPlist.mockImplementationOnce((config, callback) => {
        callback({ ios: { bundleIdentifier: 'com.example.app' }, modResults });
        return config;
      });

      withCIOIos(mockConfig, undefined, propsWithAppGroup);

      expect(modResults['com.apple.security.application-groups']).toEqual([
        'group.other.app',
        'group.com.example.app',
      ]);
    });

    it('does not call withEntitlementsPlist when push is not configured', () => {
      withCIOIos(mockConfig, undefined, { iosPath: '/test/ios' });

      expect(mockWithEntitlementsPlist).not.toHaveBeenCalled();
    });
  });
});
