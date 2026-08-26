import type { ExpoConfig } from '@expo/config-types';
import { withCIOIos } from '../../plugin/src/ios/withCIOIos';
import { isExpoVersion58OrHigher } from '../../plugin/src/ios/utils';
import type { CustomerIOPluginGeofenceOptions, CustomerIOPluginLocationOptions, CustomerIOPluginOptionsIOS } from '../../plugin/src/types/cio-types';

const mockWithCioXcodeProject = jest.fn((config: ExpoConfig, _props?: object) => config);
const mockWithCioPushDisableGuard = jest.fn((config: ExpoConfig) => config);
const mockWithCIOIosSwift = jest.fn((config: ExpoConfig, ..._args: unknown[]) => config);
const mockWithCIOIosLiveActivityCleanup = jest.fn((config: ExpoConfig) => config);
const mockWithAppDelegateModifications = jest.fn((config: ExpoConfig) => config);
const mockWithCioNotificationsXcodeProject = jest.fn((config: ExpoConfig) => config);
const mockWithGoogleServicesJsonFile = jest.fn((config: ExpoConfig) => config);
const mockWithGeofenceAppDelegate = jest.fn((config: ExpoConfig) => config);
const mockWithLiveActivityInfoPlist = jest.fn((config: ExpoConfig) => config);
const mockWithCioLiveActivityWidgetXcodeProject = jest.fn((config: ExpoConfig) => config);
const mockWithCioLiveActivityDisableGuard = jest.fn((config: ExpoConfig) => config);
const mockWithCIOSceneDelegate = jest.fn((config: ExpoConfig, _options: object) => config);
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
  withCioPushDisableGuard: (config: ExpoConfig) =>
    mockWithCioPushDisableGuard(config),
}));
jest.mock('../../plugin/src/ios/withCIOIosSwift', () => ({
  withCIOIosSwift: (config: ExpoConfig, ...args: unknown[]) =>
    mockWithCIOIosSwift(config, ...args),
  withCIOIosLiveActivityCleanup: (config: ExpoConfig) =>
    mockWithCIOIosLiveActivityCleanup(config),
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
jest.mock('../../plugin/src/ios/withGeofenceAppDelegate', () => ({
  withGeofenceAppDelegate: (config: ExpoConfig) =>
    mockWithGeofenceAppDelegate(config),
}));
jest.mock('../../plugin/src/ios/withLiveActivityInfoPlist', () => ({
  withLiveActivityInfoPlist: (config: ExpoConfig) =>
    mockWithLiveActivityInfoPlist(config),
}));
jest.mock('../../plugin/src/ios/withCioLiveActivityWidgetXcodeProject', () => ({
  withCioLiveActivityWidgetXcodeProject: (config: ExpoConfig) =>
    mockWithCioLiveActivityWidgetXcodeProject(config),
  withCioLiveActivityDisableGuard: (config: ExpoConfig) =>
    mockWithCioLiveActivityDisableGuard(config),
}));
jest.mock('../../plugin/src/ios/withCIOSceneDelegate', () => ({
  withCIOSceneDelegate: (config: ExpoConfig, options: object) =>
    mockWithCIOSceneDelegate(config, options),
}));
jest.mock('../../plugin/src/ios/utils', () => ({
  isExpoVersion53OrHigher: jest.fn(() => true),
  isExpoVersion58OrHigher: jest.fn(() => false),
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
    (isExpoVersion58OrHigher as jest.Mock).mockReturnValue(false);
  });

  describe('scene lifecycle', () => {
    it('does not modify SceneDelegate before Expo SDK 58', () => {
      withCIOIos(mockConfig, undefined, undefined, undefined, undefined, { enabled: true });

      expect(mockWithCIOSceneDelegate).not.toHaveBeenCalled();
      expect(mockWithCIOIosSwift).toHaveBeenCalledWith(
        mockConfig,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        false
      );
    });

    it('uses the scene integration for Expo SDK 58 and later', () => {
      (isExpoVersion58OrHigher as jest.Mock).mockReturnValue(true);

      withCIOIos(mockConfig, undefined, undefined, undefined, undefined, { enabled: true });

      expect(mockWithCIOSceneDelegate).toHaveBeenCalledWith(mockConfig, {
        liveNotificationsEnabled: true,
      });
      expect(mockWithCIOIosSwift).toHaveBeenCalledWith(
        mockConfig,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        true
      );
    });
  });

  describe('location-only (no push, no config)', () => {
    it('calls withCioXcodeProject with location subspec when location.enabled is true', () => {
      const location: CustomerIOPluginLocationOptions = { enabled: true };

      withCIOIos(mockConfig, undefined, undefined, location);

      expect(mockWithCIOIosSwift).not.toHaveBeenCalled();
      expect(mockWithCIOIosLiveActivityCleanup).toHaveBeenCalledWith(
        mockConfig
      );
      expect(mockWithCioNotificationsXcodeProject).not.toHaveBeenCalled();
      expect(mockWithCioPushDisableGuard).toHaveBeenCalledWith(mockConfig);
      expect(mockWithCioXcodeProject).toHaveBeenCalledTimes(1);
      expect(mockWithCioXcodeProject).toHaveBeenCalledWith(mockConfig, {
        podfileOptions: {
          locationEnabled: true,
          geofenceEnabled: false,
          hasPush: false,
          liveNotificationsEnabled: false,
        },
      });
      expect(mockWithGeofenceAppDelegate).not.toHaveBeenCalled();
    });

    it('does not remove existing native dependencies when location.enabled is false', () => {
      const location: CustomerIOPluginLocationOptions = { enabled: false };

      withCIOIos(mockConfig, undefined, undefined, location);

      expect(mockWithCIOIosLiveActivityCleanup).toHaveBeenCalledWith(
        mockConfig
      );
      expect(mockWithCioXcodeProject).not.toHaveBeenCalled();
    });

    it('does not remove existing native dependencies when location is omitted', () => {
      withCIOIos(mockConfig, undefined, undefined, undefined);

      expect(mockWithCioPushDisableGuard).toHaveBeenCalledWith(mockConfig);
      expect(mockWithCioXcodeProject).not.toHaveBeenCalled();
    });
  });

  it('does not register the push removal guard while push is configured', () => {
    withCIOIos(mockConfig, undefined, {
      iosPath: '/test/ios',
      pushNotification: { provider: 'apn' },
    });

    expect(mockWithCioPushDisableGuard).not.toHaveBeenCalled();
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

  describe('geofence-only (no push, no config)', () => {
    const geofence: CustomerIOPluginGeofenceOptions = { enabled: true };

    it('adds the geofence subspec and injects the AppDelegate bootstrap when geofence.enabled', () => {
      withCIOIos(mockConfig, undefined, undefined, undefined, geofence);

      expect(mockWithCIOIosSwift).not.toHaveBeenCalled();
      expect(mockWithCIOIosLiveActivityCleanup).toHaveBeenCalledWith(
        mockConfig
      );
      expect(mockWithCioXcodeProject).toHaveBeenCalledTimes(1);
      expect(mockWithCioXcodeProject).toHaveBeenCalledWith(mockConfig, {
        podfileOptions: {
          locationEnabled: false,
          geofenceEnabled: true,
          hasPush: false,
          liveNotificationsEnabled: false,
        },
      });
      expect(mockWithGeofenceAppDelegate).toHaveBeenCalledTimes(1);
    });

    it('does nothing when geofence.enabled is false', () => {
      withCIOIos(mockConfig, undefined, undefined, undefined, { enabled: false });

      expect(mockWithCioXcodeProject).not.toHaveBeenCalled();
      expect(mockWithGeofenceAppDelegate).not.toHaveBeenCalled();
    });

    it('combines location and geofence subspec flags when both enabled', () => {
      withCIOIos(mockConfig, undefined, undefined, { enabled: true }, geofence);

      expect(mockWithCioXcodeProject).toHaveBeenCalledWith(mockConfig, {
        podfileOptions: {
          locationEnabled: true,
          geofenceEnabled: true,
          hasPush: false,
          liveNotificationsEnabled: false,
        },
      });
      expect(mockWithGeofenceAppDelegate).toHaveBeenCalledTimes(1);
    });
  });

  describe('geofence with push', () => {
    it('passes geofenceEnabled to the Podfile and injects the AppDelegate bootstrap', () => {
      const props: CustomerIOPluginOptionsIOS = {
        iosPath: '/test/ios',
        pushNotification: { provider: 'apn' },
      };

      withCIOIos(mockConfig, undefined, props, undefined, { enabled: true });

      expect(mockWithCioXcodeProject).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          podfileOptions: expect.objectContaining({
            geofenceEnabled: true,
            hasPush: true,
          }),
        })
      );
      expect(mockWithGeofenceAppDelegate).toHaveBeenCalledTimes(1);
    });
  });

  describe('live activities', () => {
    it('injects the SDK 58 scene, widget, Info.plist and liveactivities subspec (no push/config)', () => {
      // Live Notifications without push is supported: an app can obtain a device token elsewhere and
      // hand it to Customer.io for backend-driven activities. withCIOIosSwift has to run on this path
      // too — it is what routes a tapped activity's URL through the SDK, so without it the `opened`
      // metric is lost and the deep link is never forwarded.
      const props: CustomerIOPluginOptionsIOS = {
        iosPath: '/test/ios',
      };
      (isExpoVersion58OrHigher as jest.Mock).mockReturnValue(true);

      withCIOIos(mockConfig, undefined, props, undefined, undefined, { enabled: true });

      expect(mockWithCIOIosSwift).toHaveBeenCalledTimes(1);
      expect(mockWithLiveActivityInfoPlist).toHaveBeenCalledTimes(1);
      expect(mockWithCioLiveActivityWidgetXcodeProject).toHaveBeenCalledTimes(1);
      expect(mockWithCIOSceneDelegate).toHaveBeenCalledWith(mockConfig, {
        liveNotificationsEnabled: true,
      });
      expect(mockWithCioNotificationsXcodeProject).not.toHaveBeenCalled();
      expect(mockWithGeofenceAppDelegate).not.toHaveBeenCalled();
      expect(mockWithCioXcodeProject).toHaveBeenCalledWith(mockConfig, {
        ...props,
        podfileOptions: {
          locationEnabled: false,
          geofenceEnabled: false,
          hasPush: false,
          liveNotificationsEnabled: true,
        },
      });
    });

    it('adds the liveactivities subspec alongside push when both are enabled', () => {
      const props: CustomerIOPluginOptionsIOS = {
        iosPath: '/test/ios',
        pushNotification: { provider: 'apn' },
      };

      withCIOIos(mockConfig, undefined, props, undefined, undefined, { enabled: true });

      expect(mockWithLiveActivityInfoPlist).toHaveBeenCalledTimes(1);
      expect(mockWithCioLiveActivityWidgetXcodeProject).toHaveBeenCalledTimes(1);
      expect(mockWithCioXcodeProject).toHaveBeenCalledWith(
        mockConfig,
        expect.objectContaining({
          podfileOptions: {
            locationEnabled: false,
            geofenceEnabled: false,
            hasPush: true,
            liveNotificationsEnabled: true,
          },
        }),
      );
    });

    it('does not inject the widget when liveNotifications.enabled is false', () => {
      withCIOIos(
        mockConfig,
        undefined,
        { iosPath: '/test/ios' },
        undefined,
        undefined,
        { enabled: false },
      );

      expect(mockWithLiveActivityInfoPlist).not.toHaveBeenCalled();
      expect(mockWithCioLiveActivityWidgetXcodeProject).not.toHaveBeenCalled();
      expect(mockWithCioXcodeProject).not.toHaveBeenCalled();
      expect(mockWithCioLiveActivityDisableGuard).toHaveBeenCalledWith(
        mockConfig
      );
    });

    // app.json is untyped, so `ios` being required in CustomerIOPluginOptions doesn't stop an app
    // from omitting it. Gating the widget on its presence added the subspec but skipped the plist key
    // and the target, so nothing could start or render an activity — silently. Location and geofence
    // already work without an `ios` block; this keeps Live Notifications consistent with them.
    it('injects the widget and Info.plist when there is no ios props block at all', () => {
      withCIOIos(mockConfig, undefined, undefined, undefined, undefined, { enabled: true });

      expect(mockWithCIOIosSwift).toHaveBeenCalledTimes(1);
      expect(mockWithLiveActivityInfoPlist).toHaveBeenCalledTimes(1);
      expect(mockWithCioLiveActivityWidgetXcodeProject).toHaveBeenCalledTimes(1);
      expect(mockWithCioXcodeProject).toHaveBeenCalledWith(mockConfig, {
        podfileOptions: {
          locationEnabled: false,
          geofenceEnabled: false,
          hasPush: false,
          liveNotificationsEnabled: true,
        },
      });
    });

    it('injects the widget on the auto-init path with no ios props block', () => {
      const sdkConfig = {
        cdpApiKey: 'key',
        liveNotifications: { types: ['io.customer.livenotifications.segments'] },
      };

      withCIOIos(mockConfig, sdkConfig, undefined);

      expect(mockWithCIOIosSwift).toHaveBeenCalledTimes(1);
      expect(mockWithLiveActivityInfoPlist).toHaveBeenCalledTimes(1);
      expect(mockWithCioLiveActivityWidgetXcodeProject).toHaveBeenCalledTimes(1);
    });

    // `enabled: false` is an explicit opt-out, so it has to win over an SDK config that would
    // otherwise imply the feature. Without this an app could not turn the build-time setup off
    // without also deleting its type list.
    it('treats enabled:false as a kill switch over config.liveNotifications', () => {
      const sdkConfig = {
        cdpApiKey: 'key',
        liveNotifications: { types: ['io.customer.livenotifications.segments'] },
      };

      withCIOIos(mockConfig, sdkConfig, { iosPath: '/test/ios' }, undefined, undefined, {
        enabled: false,
      });

      expect(mockWithLiveActivityInfoPlist).not.toHaveBeenCalled();
      expect(mockWithCioLiveActivityWidgetXcodeProject).not.toHaveBeenCalled();
      expect(mockWithCioXcodeProject).not.toHaveBeenCalled();
      expect(mockWithCioLiveActivityDisableGuard).toHaveBeenCalledWith(
        mockConfig
      );
    });
  });

    it('adds both subspecs when geofence and live activities are enabled together', () => {
      const props: CustomerIOPluginOptionsIOS = {
        iosPath: '/test/ios',
        pushNotification: { provider: 'apn' },
      };

      withCIOIos(mockConfig, undefined, props, undefined, { enabled: true }, { enabled: true });

      expect(mockWithGeofenceAppDelegate).toHaveBeenCalledTimes(1);
      expect(mockWithLiveActivityInfoPlist).toHaveBeenCalledTimes(1);
      expect(mockWithCioXcodeProject).toHaveBeenCalledWith(
        mockConfig,
        expect.objectContaining({
          podfileOptions: {
            locationEnabled: false,
            geofenceEnabled: true,
            hasPush: true,
            liveNotificationsEnabled: true,
          },
        }),
      );
    });
});
