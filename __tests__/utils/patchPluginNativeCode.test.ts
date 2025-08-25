import path from 'path';
import { PLATFORM } from '../../plugin/src/helpers/constants/common';
import { FileManagement } from '../../plugin/src/helpers/utils/fileManagement';
import {
  patchNativeSDKInitializer,
} from '../../plugin/src/helpers/utils/patchPluginNativeCode';
import type { NativeSDKConfig } from '../../plugin/src/types/cio-types';
import { getPluginVersion } from '../../plugin/src/utils/plugin';

// Mock dependencies
jest.mock('../../plugin/src/utils/plugin');
const mockGetPluginVersion = getPluginVersion as jest.MockedFunction<typeof getPluginVersion>;

describe('Native SDK Configuration Patching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPluginVersion.mockReturnValue('2.5.0');
  });

  describe('patchNativeSDKInitializer()', () => {
    const baseSdkConfig: NativeSDKConfig = {
      cdpApiKey: 'test-api-key',
    };

    const mockContent = `
      version: {{EXPO_PLUGIN_VERSION}}
      apiKey: {{CDP_API_KEY}}
      region: {{REGION}}
      logLevel: {{LOG_LEVEL}}
      autoTrack: {{AUTO_TRACK_DEVICE_ATTRIBUTES}}
      lifecycle: {{TRACK_APPLICATION_LIFECYCLE_EVENTS}}
      screenView: {{SCREEN_VIEW_USE}}
      siteId: {{SITE_ID}}
      migrationSiteId: {{MIGRATION_SITE_ID}}
    `;

    // Read the actual template files
    const swiftTemplateContent = FileManagement.readFile(
      path.join(__dirname, '../../plugin/src/helpers/native-files/ios/CustomerIOSDKInitializer.swift')
    );

    const kotlinTemplateContent = FileManagement.readFile(
      path.join(__dirname, '../../plugin/src/helpers/native-files/android/CustomerIOSDKInitializer.kt')
    );

    test('requires platform parameter for TypeScript compilation', () => {
      // This test ensures the platform parameter is required
      expect(() => {
        // @ts-expect-error Testing that platform parameter is required
        patchNativeSDKInitializer(mockContent, baseSdkConfig);
      }).toBeDefined(); // Just testing TypeScript compilation requirement
    });

    test('replaces undefined optional values with nil fallbacks on iOS platform', () => {
      const result = patchNativeSDKInitializer(mockContent, PLATFORM.IOS, baseSdkConfig);

      expect(result).toContain('version: 2.5.0');
      expect(result).toContain('apiKey: test-api-key');
      expect(result).toContain('region: ""'); // Empty string fallback for region (nil not supported)
      expect(result).toContain('logLevel: nil');
      expect(result).toContain('autoTrack: nil');
      expect(result).toContain('lifecycle: nil');
      expect(result).toContain('screenView: nil');
    });

    test('replaces undefined optional values with null fallbacks on Android platform', () => {
      const result = patchNativeSDKInitializer(mockContent, PLATFORM.ANDROID, baseSdkConfig);

      expect(result).toContain('version: 2.5.0');
      expect(result).toContain('apiKey: test-api-key');
      expect(result).toContain('region: ""'); // Empty string fallback for region (nil not supported)
      expect(result).toContain('logLevel: null'); // null for Android platform
      expect(result).toContain('autoTrack: null');
      expect(result).toContain('lifecycle: null');
      expect(result).toContain('screenView: null');
    });


    test('preserves explicit boolean values for both true and false', () => {
      const testCases = [true, false];

      testCases.forEach(value => {
        const config = {
          ...baseSdkConfig,
          autoTrackDeviceAttributes: value,
          trackApplicationLifecycleEvents: value,
        };
        const iosResult = patchNativeSDKInitializer(mockContent, PLATFORM.IOS, config);
        const androidResult = patchNativeSDKInitializer(mockContent, PLATFORM.ANDROID, config);

        expect(iosResult).toContain(`autoTrack: ${value}`);
        expect(iosResult).toContain(`lifecycle: ${value}`);
        expect(androidResult).toContain(`autoTrack: ${value}`);
        expect(androidResult).toContain(`lifecycle: ${value}`);
      });
    });


    test('handles all valid screenViewUse enum values on both platforms', () => {
      const testCases = ['all', 'inapp'] as const;

      testCases.forEach(screenViewUse => {
        const config = { ...baseSdkConfig, screenViewUse };
        const iosResult = patchNativeSDKInitializer(mockContent, PLATFORM.IOS, config);
        const androidResult = patchNativeSDKInitializer(mockContent, PLATFORM.ANDROID, config);

        expect(iosResult).toContain(`screenView: "${screenViewUse}"`);
        expect(androidResult).toContain(`screenView: "${screenViewUse}"`);
      });
    });

    test('handles all valid logLevel enum values on both platforms', () => {
      const testCases = ['debug', 'info', 'error', 'none'] as const;

      testCases.forEach(logLevel => {
        const config = { ...baseSdkConfig, logLevel };
        const iosResult = patchNativeSDKInitializer(mockContent, PLATFORM.IOS, config);
        const androidResult = patchNativeSDKInitializer(mockContent, PLATFORM.ANDROID, config);

        expect(iosResult).toContain(`logLevel: "${logLevel}"`);
        expect(androidResult).toContain(`logLevel: "${logLevel}"`);
      });
    });

    test('handles all valid region enum values on both platforms', () => {
      const testCases = ['US', 'EU'] as const;

      testCases.forEach(region => {
        const config = { ...baseSdkConfig, region };
        const iosResult = patchNativeSDKInitializer(mockContent, PLATFORM.IOS, config);
        const androidResult = patchNativeSDKInitializer(mockContent, PLATFORM.ANDROID, config);

        expect(iosResult).toContain(`region: "${region}"`);
        expect(androidResult).toContain(`region: "${region}"`);
      });
    });


    describe('siteId and migrationSiteId business logic', () => {
      test('uses explicit migrationSiteId when provided', () => {
        const config = { ...baseSdkConfig, migrationSiteId: 'explicit-migration-id' };
        const iosResult = patchNativeSDKInitializer(mockContent, PLATFORM.IOS, config);
        const androidResult = patchNativeSDKInitializer(mockContent, PLATFORM.ANDROID, config);

        // migrationSiteId = migrationSiteId (when defined)
        expect(iosResult).toContain('migrationSiteId: "explicit-migration-id"');
        expect(androidResult).toContain('migrationSiteId: "explicit-migration-id"');
        // siteId should be nil/null when only migrationSiteId provided
        expect(iosResult).toContain('siteId: nil');
        expect(androidResult).toContain('siteId: null');
      });

      test('copies siteId to migrationSiteId when migrationSiteId is undefined', () => {
        const config = { ...baseSdkConfig, siteId: 'main-site-id' };
        const iosResult = patchNativeSDKInitializer(mockContent, PLATFORM.IOS, config);
        const androidResult = patchNativeSDKInitializer(mockContent, PLATFORM.ANDROID, config);

        // migrationSiteId = siteId (when migrationSiteId undefined and siteId defined)
        expect(iosResult).toContain('migrationSiteId: "main-site-id"');
        expect(androidResult).toContain('migrationSiteId: "main-site-id"');
        expect(iosResult).toContain('siteId: "main-site-id"');
        expect(androidResult).toContain('siteId: "main-site-id"');
      });

      test('sets both siteId and migrationSiteId to platform null when both are undefined', () => {
        const iosResult = patchNativeSDKInitializer(mockContent, PLATFORM.IOS, baseSdkConfig);
        const androidResult = patchNativeSDKInitializer(mockContent, PLATFORM.ANDROID, baseSdkConfig);

        // migrationSiteId = nil/null (when both undefined)
        expect(iosResult).toContain('migrationSiteId: nil');
        expect(androidResult).toContain('migrationSiteId: null');
        expect(iosResult).toContain('siteId: nil');
        expect(androidResult).toContain('siteId: null');
      });

      test('preserves distinct values when both siteId and migrationSiteId are provided', () => {
        const config = { ...baseSdkConfig, siteId: 'site123', migrationSiteId: 'migration456' };
        const iosResult = patchNativeSDKInitializer(mockContent, PLATFORM.IOS, config);
        const androidResult = patchNativeSDKInitializer(mockContent, PLATFORM.ANDROID, config);

        expect(iosResult).toContain('siteId: "site123"');
        expect(iosResult).toContain('migrationSiteId: "migration456"');
        expect(androidResult).toContain('siteId: "site123"');
        expect(androidResult).toContain('migrationSiteId: "migration456"');
      });

      test('treats empty or whitespace-only siteId as undefined and uses platform null', () => {
        const testCases = ['', '   '];

        testCases.forEach(siteId => {
          const config = { ...baseSdkConfig, siteId };
          const iosResult = patchNativeSDKInitializer(mockContent, PLATFORM.IOS, config);
          const androidResult = patchNativeSDKInitializer(mockContent, PLATFORM.ANDROID, config);

          expect(iosResult).toContain('siteId: nil');
          expect(iosResult).toContain('migrationSiteId: nil');
          expect(androidResult).toContain('siteId: null');
          expect(androidResult).toContain('migrationSiteId: null');
        });
      });
    });

    describe('snapshots', () => {
      test('iOS complete', () => {
        const config = {
          ...baseSdkConfig,
          logLevel: 'debug' as const,
          region: 'US' as const,
          siteId: 'test-site-123',
          autoTrackDeviceAttributes: true,
          trackApplicationLifecycleEvents: false,
          screenViewUse: 'inapp' as const,
        };

        const result = patchNativeSDKInitializer(swiftTemplateContent, PLATFORM.IOS, config);
        expect(result).toMatchSnapshot();
      });

      test('iOS minimal', () => {
        const result = patchNativeSDKInitializer(swiftTemplateContent, PLATFORM.IOS, baseSdkConfig);
        expect(result).toMatchSnapshot();
      });

      test('Android complete', () => {
        const config = {
          ...baseSdkConfig,
          logLevel: 'info' as const,
          region: 'EU' as const,
          siteId: 'android-site-456',
          autoTrackDeviceAttributes: false,
          trackApplicationLifecycleEvents: true,
          screenViewUse: 'all' as const,
        };

        const result = patchNativeSDKInitializer(kotlinTemplateContent, PLATFORM.ANDROID, config);
        expect(result).toMatchSnapshot();
      });

      test('Android minimal', () => {
        const result = patchNativeSDKInitializer(kotlinTemplateContent, PLATFORM.ANDROID, baseSdkConfig);
        expect(result).toMatchSnapshot();
      });
    });
  });
});
