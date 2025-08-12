import type { CustomerIOPluginOptionsIOS, NativeSDKConfig } from '../../plugin/src/types/cio-types';
import { mergeConfigWithEnvValues } from '../../plugin/src/utils/config';

describe('mergeConfigWithEnvValues', () => {
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

  describe('priority handling', () => {
    test('should prioritize env config over native config', () => {
      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: {
          env: mockEnvConfig,
        },
      };

      const result = mergeConfigWithEnvValues(props, mockNativeConfig);

      expect(result).toEqual({
        cdpApiKey: 'env-api-key',
        region: 'US',
      });
    });

    test('should use env config when native config is not provided', () => {
      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: {
          env: mockEnvConfig,
        },
      };

      const result = mergeConfigWithEnvValues(props);

      expect(result).toEqual({
        cdpApiKey: 'env-api-key',
        region: 'US',
      });
    });

    test('should use native config when env config is not provided', () => {
      const result = mergeConfigWithEnvValues(mockIosProps, mockNativeConfig);

      expect(result).toEqual({
        cdpApiKey: 'config-api-key',
        region: 'EU',
      });
    });

  });

  describe('native config scenarios', () => {

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

  describe('env config scenarios', () => {

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

  describe('no config scenarios', () => {
    test('should return undefined when no native config and no pushNotification', () => {
      const result = mergeConfigWithEnvValues(mockIosProps);

      expect(result).toBeUndefined();
    });

    test('should return undefined when no native config and no env config', () => {
      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: {},
      };

      const result = mergeConfigWithEnvValues(props);

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

  describe('edge cases', () => {
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
