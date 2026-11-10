import type { CustomerIOPluginOptionsIOS, NativeSDKConfig } from '../../plugin/src/types/cio-types';
import { mergeConfigWithEnvValues, resolveNseApiHost } from '../../plugin/src/utils/config';

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
        '[CustomerIO] Both \'config\' and \'ios.pushNotification.env\' are provided with matching values. Consider removing \'ios.pushNotification.env\' since \'config\' is already specified.'
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
        '[CustomerIO] Both \'config\' and \'ios.pushNotification.env\' are provided with matching values. Consider removing \'ios.pushNotification.env\' since \'config\' is already specified.'
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

  describe('when the key carries its region', () => {
    test('takes the region from a pk_ key in config when none is set', () => {
      const result = mergeConfigWithEnvValues(mockIosProps, { cdpApiKey: 'pk_eu_abc' });

      expect(result).toEqual({ cdpApiKey: 'pk_eu_abc', region: 'EU' });
    });

    test('takes the region from a pk_ key in env when none is set', () => {
      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: { env: { cdpApiKey: 'pk_eu_abc' } },
      };

      expect(mergeConfigWithEnvValues(props)).toEqual({ cdpApiKey: 'pk_eu_abc', region: 'EU' });
    });

    test('keeps the region the app sets over the key', () => {
      const result = mergeConfigWithEnvValues(mockIosProps, {
        cdpApiKey: 'pk_eu_abc',
        region: 'US',
      });

      expect(result).toEqual({ cdpApiKey: 'pk_eu_abc', region: 'US' });
    });

    test('treats a matching key region as the same region as an explicit one', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const props: CustomerIOPluginOptionsIOS = {
        ...mockIosProps,
        pushNotification: { env: { cdpApiKey: 'pk_eu_abc', region: 'eu' } },
      };

      const result = mergeConfigWithEnvValues(props, { cdpApiKey: 'pk_eu_abc' });

      expect(result).toEqual({ cdpApiKey: 'pk_eu_abc', region: 'EU' });
      consoleSpy.mockRestore();
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

describe('resolveNseApiHost - NSE host falls back to config.apiHost', () => {
  const nse = (apiHost?: string): CustomerIOPluginOptionsIOS => ({
    iosPath: 'ios',
    pushNotification: apiHost === undefined ? {} : { apiHost },
  });
  const native = (apiHost?: string): NativeSDKConfig => ({ cdpApiKey: 'key', apiHost });

  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });
  afterEach(() => warnSpy.mockRestore());

  test('keeps pushNotification.apiHost without auto-init', () => {
    expect(resolveNseApiHost(nse('proxy.example.com'), undefined)).toBe('proxy.example.com');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('returns undefined when neither is set', () => {
    expect(resolveNseApiHost(nse(), native())).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('uses config.apiHost when pushNotification.apiHost is not set', () => {
    expect(resolveNseApiHost(nse(), native(' proxy.example.com/v1 '))).toBe('proxy.example.com/v1');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('warns about redundant config when both match', () => {
    expect(resolveNseApiHost(nse('proxy.example.com'), native('proxy.example.com'))).toBe('proxy.example.com');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Consider removing'));
  });

  test('keeps pushNotification.apiHost and warns when they differ', () => {
    expect(resolveNseApiHost(nse('nse.example.com'), native('app.example.com'))).toBe('nse.example.com');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('differ'));
  });

  test('ignores a non-string config.apiHost', () => {
    const config = { cdpApiKey: 'key', apiHost: 8080 } as unknown as NativeSDKConfig;
    expect(resolveNseApiHost(nse(), config)).toBeUndefined();
  });
});
