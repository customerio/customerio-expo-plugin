import type { CustomerIOPluginOptionsIOS, NativeSDKConfig } from '../../plugin/src/types/cio-types';
import { mergeConfigWithEnvValues } from '../../plugin/src/utils/config';

describe('mergeConfigWithEnvValues - Resolves conflicts between legacy env config and new native config', () => {
  const mockIosProps: CustomerIOPluginOptionsIOS = {
    iosPath: 'ios',
  };

  const mockNativeConfig: NativeSDKConfig = {
    cdpApiKey: 'config-api-key',
    region: 'EU',
  };

  const mockEnvConfig = {
    cdpApiKey: 'env-api-key',
    region: 'US',
  };

  describe('when both environment and native configs are provided', () => {
    test('should throw error when configs have conflicting values', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: {
          env: mockEnvConfig,
        },
      };

      expect(() => mergeConfigWithEnvValues(props, mockNativeConfig)).toThrow(
        'Configuration conflict: \'config\' and \'ios.pushNotification.env\' values must match when both are provided.'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration conflict'));
      consoleErrorSpy.mockRestore();
    });

    test('should warn and return config when both configs have matching values', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const matchingEnvConfig = {
        cdpApiKey: 'same-api-key',
        region: 'EU',
      };

      const matchingNativeConfig: NativeSDKConfig = {
        cdpApiKey: 'same-api-key',
        region: 'EU',
      };

      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: {
          env: matchingEnvConfig,
        },
      };

      const result = mergeConfigWithEnvValues(props, matchingNativeConfig);

      expect(result).toEqual({
        cdpApiKey: 'same-api-key',
        region: 'EU',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Both \'config\' and \'ios.pushNotification.env\' are provided with matching values. Consider removing \'ios.pushNotification.env\' since \'config\' is already specified.'
      );

      consoleSpy.mockRestore();
    });

    test('should allow case-insensitive region matching', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const envWithLowerCase = {
        cdpApiKey: 'same-api-key',
        region: 'us',
      };

      const nativeWithUpperCase: NativeSDKConfig = {
        cdpApiKey: 'same-api-key',
        region: 'US',
      };

      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: {
          env: envWithLowerCase,
        },
      };

      const result = mergeConfigWithEnvValues(props, nativeWithUpperCase);

      expect(result).toEqual({
        cdpApiKey: 'same-api-key',
        region: 'US', // Should return nativeConfig value
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Both \'config\' and \'ios.pushNotification.env\' are provided with matching values. Consider removing \'ios.pushNotification.env\' since \'config\' is already specified.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('when only native config is provided', () => {

    test('should return native config with undefined region when only cdpApiKey is provided', () => {
      const configWithoutRegion: NativeSDKConfig = {
        cdpApiKey: 'config-api-key',
      };

      const result = mergeConfigWithEnvValues(mockIosProps, configWithoutRegion);

      expect(result).toEqual({
        cdpApiKey: 'config-api-key',
        region: undefined,
      });
    });

    test('should return undefined when native config has no cdpApiKey', () => {
      const configWithoutApiKey = {
        region: 'EU',
        autoTrackDeviceAttributes: true,
      } as any;

      const result = mergeConfigWithEnvValues(mockIosProps, configWithoutApiKey);

      expect(result).toBeUndefined();
    });
  });

  describe('when only environment config is provided', () => {

    test('should return env config with undefined region when only cdpApiKey is provided', () => {
      const envConfigWithoutRegion = {
        cdpApiKey: 'env-api-key',
      };

      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: {
          env: envConfigWithoutRegion,
        },
      };

      const result = mergeConfigWithEnvValues(props);

      expect(result).toEqual({
        cdpApiKey: 'env-api-key',
        region: undefined,
      });
    });

    test('should return undefined when env config has no cdpApiKey', () => {
      const envConfigWithoutApiKey = {
        region: 'US',
      } as any;

      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: {
          env: envConfigWithoutApiKey,
        },
      };

      const result = mergeConfigWithEnvValues(props);

      expect(result).toBeUndefined();
    });
  });

  describe('when no valid configuration is provided', () => {
    test('should return undefined when no configs provided', () => {
      const result = mergeConfigWithEnvValues(mockIosProps);

      expect(result).toBeUndefined();
    });

    test('should return undefined when both configs are empty', () => {
      const emptyNativeConfig = {} as any;
      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: {
          env: {} as any,
        },
      };

      const result = mergeConfigWithEnvValues(props, emptyNativeConfig);

      expect(result).toBeUndefined();
    });
  });

  describe('when handling invalid or malformed configuration data', () => {
    test('should handle undefined pushNotification gracefully', () => {
      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: undefined,
      };

      const result = mergeConfigWithEnvValues(props);

      expect(result).toBeUndefined();
    });

    test('should handle empty strings in cdpApiKey', () => {
      const configWithEmptyApiKey = {
        cdpApiKey: '',
        region: 'EU',
      } as any;

      const result = mergeConfigWithEnvValues(mockIosProps, configWithEmptyApiKey);

      expect(result).toBeUndefined();
    });

    test('should handle null values gracefully', () => {
      const configWithNullApiKey = {
        cdpApiKey: null,
        region: 'EU',
      } as any;

      const result = mergeConfigWithEnvValues(mockIosProps, configWithNullApiKey);

      expect(result).toBeUndefined();
    });
  });
});
