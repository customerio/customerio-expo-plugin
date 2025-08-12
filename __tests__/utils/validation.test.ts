import type { NativeSDKConfig } from '../../plugin/src/types/cio-types';
import { validateNativeSDKConfig } from '../../plugin/src/utils/validation';

describe('validateNativeSDKConfig', () => {
  const validConfig: NativeSDKConfig = {
    cdpApiKey: 'test-api-key'
  };

  describe('cdpApiKey validation', () => {
    test('should pass with valid cdpApiKey', () => {
      expect(() => validateNativeSDKConfig(validConfig)).not.toThrow();
    });

    test('should throw when cdpApiKey is missing', () => {
      const config = {} as any;
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: cdpApiKey is required, received: undefined'
      );
    });

    test('should throw when cdpApiKey is null', () => {
      const config = { cdpApiKey: null } as any;
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: cdpApiKey is required, received: null'
      );
    });


    test('should throw when cdpApiKey is empty string', () => {
      const config = { cdpApiKey: '' };
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: cdpApiKey must be a non-empty string, received: ""'
      );
    });

    test('should throw when cdpApiKey is whitespace only', () => {
      const config = { cdpApiKey: '   ' };
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: cdpApiKey must be a non-empty string, received: "   "'
      );
    });

    test('should throw when cdpApiKey is not a string', () => {
      const config = { cdpApiKey: 123 } as any;
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: cdpApiKey must be a non-empty string, received: 123'
      );
    });
  });

  describe('region validation', () => {
    test('should pass with valid region US', () => {
      const config = { ...validConfig, region: 'US' as const };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with valid region EU', () => {
      const config = { ...validConfig, region: 'EU' as const };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass when region is undefined', () => {
      const config = { ...validConfig, region: undefined };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with lowercase region', () => {
      const config = { ...validConfig, region: 'us' } as any;
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with mixed case region', () => {
      const config = { ...validConfig, region: 'eU' } as any;
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should throw with invalid region', () => {
      const config = { ...validConfig, region: 'INVALID' } as any;
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: region must be one of "US", "EU", received: INVALID'
      );
    });
  });

  describe('screenViewUse validation', () => {
    test('should pass with valid screenViewUse all', () => {
      const config = { ...validConfig, screenViewUse: 'all' as const };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with valid screenViewUse inapp', () => {
      const config = { ...validConfig, screenViewUse: 'inapp' as const };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass when screenViewUse is undefined', () => {
      const config = { ...validConfig, screenViewUse: undefined };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with uppercase screenViewUse', () => {
      const config = { ...validConfig, screenViewUse: 'ALL' } as any;
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with mixed case screenViewUse', () => {
      const config = { ...validConfig, screenViewUse: 'InApp' } as any;
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should throw with invalid screenViewUse', () => {
      const config = { ...validConfig, screenViewUse: 'invalid' } as any;
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: screenViewUse must be one of "all", "inapp", received: invalid'
      );
    });
  });

  describe('logLevel validation', () => {
    test('should pass with valid logLevel none', () => {
      const config = { ...validConfig, logLevel: 'none' as const };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with valid logLevel error', () => {
      const config = { ...validConfig, logLevel: 'error' as const };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with valid logLevel info', () => {
      const config = { ...validConfig, logLevel: 'info' as const };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with valid logLevel debug', () => {
      const config = { ...validConfig, logLevel: 'debug' as const };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass when logLevel is undefined', () => {
      const config = { ...validConfig, logLevel: undefined };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with uppercase logLevel', () => {
      const config = { ...validConfig, logLevel: 'ERROR' } as any;
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with mixed case logLevel', () => {
      const config = { ...validConfig, logLevel: 'DeBuG' } as any;
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should throw with invalid logLevel', () => {
      const config = { ...validConfig, logLevel: 'invalid' } as any;
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: logLevel must be one of "none", "error", "info", "debug", received: invalid'
      );
    });
  });

  describe('boolean field validation', () => {
    test('should pass with valid autoTrackDeviceAttributes true', () => {
      const config = { ...validConfig, autoTrackDeviceAttributes: true };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with valid autoTrackDeviceAttributes false', () => {
      const config = { ...validConfig, autoTrackDeviceAttributes: false };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass when autoTrackDeviceAttributes is undefined', () => {
      const config = { ...validConfig, autoTrackDeviceAttributes: undefined };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should throw when autoTrackDeviceAttributes is not boolean', () => {
      const config = { ...validConfig, autoTrackDeviceAttributes: 'true' } as any;
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: autoTrackDeviceAttributes must be a boolean, received: true'
      );
    });

    test('should pass with valid trackApplicationLifecycleEvents true', () => {
      const config = { ...validConfig, trackApplicationLifecycleEvents: true };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with valid trackApplicationLifecycleEvents false', () => {
      const config = { ...validConfig, trackApplicationLifecycleEvents: false };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should throw when trackApplicationLifecycleEvents is not boolean', () => {
      const config = { ...validConfig, trackApplicationLifecycleEvents: 1 } as any;
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: trackApplicationLifecycleEvents must be a boolean, received: 1'
      );
    });
  });

  describe('optional string field validation', () => {
    test('should pass with valid siteId', () => {
      const config = { ...validConfig, siteId: 'test-site-id' };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass when siteId is undefined', () => {
      const config = { ...validConfig, siteId: undefined };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should throw when siteId is empty string', () => {
      const config = { ...validConfig, siteId: '' };
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: siteId must be a non-empty string, received: ""'
      );
    });

    test('should throw when siteId is whitespace only', () => {
      const config = { ...validConfig, siteId: '   ' };
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: siteId must be a non-empty string, received: "   "'
      );
    });

    test('should pass with valid migrationSiteId', () => {
      const config = { ...validConfig, migrationSiteId: 'test-migration-site-id' };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass when migrationSiteId is undefined', () => {
      const config = { ...validConfig, migrationSiteId: undefined };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should throw when migrationSiteId is empty string', () => {
      const config = { ...validConfig, migrationSiteId: '' };
      expect(() => validateNativeSDKConfig(config)).toThrow(
        'NativeSDKConfig: migrationSiteId must be a non-empty string, received: ""'
      );
    });
  });

  describe('complex configuration validation', () => {
    test('should pass with all valid optional fields', () => {
      const config: NativeSDKConfig = {
        cdpApiKey: 'test-api-key',
        region: 'US',
        autoTrackDeviceAttributes: true,
        trackApplicationLifecycleEvents: false,
        screenViewUse: 'all',
        logLevel: 'debug',
        siteId: 'test-site-id',
        migrationSiteId: 'test-migration-site-id'
      };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });

    test('should pass with minimal valid configuration', () => {
      const config: NativeSDKConfig = {
        cdpApiKey: 'test-api-key'
      };
      expect(() => validateNativeSDKConfig(config)).not.toThrow();
    });
  });
});
