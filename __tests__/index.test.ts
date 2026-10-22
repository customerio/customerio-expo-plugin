import type { ExpoConfig } from '@expo/config-types';
import withCustomerIOPlugin from '../plugin/src/index';
import { isExpoVersion53OrHigher } from '../plugin/src/ios/utils';
import { withCIOIos } from '../plugin/src/ios/withCIOIos';
import { withCIOAndroid } from '../plugin/src/android/withCIOAndroid';
import { withExpoVersion } from '../plugin/src/utils/writeExpoVersion';
import type { CustomerIOPluginOptions } from '../plugin/src/types/cio-types';

jest.mock('../plugin/src/ios/utils');
jest.mock('../plugin/src/ios/withCIOIos');
jest.mock('../plugin/src/android/withCIOAndroid');
jest.mock('../plugin/src/utils/writeExpoVersion');

const mockIsExpo53 = isExpoVersion53OrHigher as jest.MockedFunction<
  typeof isExpoVersion53OrHigher
>;
const mockWithCIOIos = withCIOIos as jest.MockedFunction<typeof withCIOIos>;
const mockWithCIOAndroid = withCIOAndroid as jest.MockedFunction<typeof withCIOAndroid>;
const mockWithExpoVersion = withExpoVersion as jest.MockedFunction<typeof withExpoVersion>;

const baseConfig = { name: 'Test', slug: 'test' } as ExpoConfig;
const baseProps: CustomerIOPluginOptions = {
  android: { androidPath: 'android' },
  ios: { iosPath: 'ios' },
};

describe('withCustomerIOPlugin geofence gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithExpoVersion.mockImplementation((c) => c);
    mockWithCIOIos.mockImplementation((c) => c);
    mockWithCIOAndroid.mockImplementation((c) => c as ExpoConfig);
  });

  it('throws when geofence.enabled on Expo < 53', () => {
    mockIsExpo53.mockReturnValue(false);

    expect(() =>
      withCustomerIOPlugin(baseConfig, { ...baseProps, geofence: { enabled: true } })
    ).toThrow(/geofence requires Expo SDK 53/);
  });

  it('does not throw and forwards geofence to platform mods on Expo 53+', () => {
    mockIsExpo53.mockReturnValue(true);

    const geofence = { enabled: true };
    withCustomerIOPlugin(baseConfig, { ...baseProps, geofence });

    expect(mockWithCIOIos).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      baseProps.ios,
      undefined,
      geofence,
      undefined,
      undefined
    );
    expect(mockWithCIOAndroid).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      baseProps.android,
      undefined,
      geofence,
      undefined,
      undefined
    );
  });

  it('does not throw when geofence is disabled on Expo < 53', () => {
    mockIsExpo53.mockReturnValue(false);

    expect(() =>
      withCustomerIOPlugin(baseConfig, { ...baseProps, geofence: { enabled: false } })
    ).not.toThrow();
  });
});

describe('withCustomerIOPlugin Live Notifications gating', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWithExpoVersion.mockImplementation((c) => c);
    mockWithCIOIos.mockImplementation((c) => c);
    mockWithCIOAndroid.mockImplementation((c) => c as ExpoConfig);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // Pre-53 projects never reach withCIOIosSwift, so the AppDelegate is never wired to route a
  // tapped activity's URL. Failing loudly beats shipping a widget whose taps go nowhere.
  it('throws when liveNotifications.enabled on Expo < 53', () => {
    mockIsExpo53.mockReturnValue(false);

    expect(() =>
      withCustomerIOPlugin(baseConfig, { ...baseProps, liveNotifications: { enabled: true } })
    ).toThrow(/Live Notifications requires Expo SDK 53/);
  });

  it('does not throw when liveNotifications is disabled on Expo < 53', () => {
    mockIsExpo53.mockReturnValue(false);

    expect(() =>
      withCustomerIOPlugin(baseConfig, { ...baseProps, liveNotifications: { enabled: false } })
    ).not.toThrow();
  });

  it('forwards liveNotifications to both platform mods on Expo 53+', () => {
    mockIsExpo53.mockReturnValue(true);

    const liveNotifications = { enabled: true };
    withCustomerIOPlugin(baseConfig, { ...baseProps, liveNotifications });

    expect(mockWithCIOIos).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      baseProps.ios,
      undefined,
      undefined,
      liveNotifications,
      undefined
    );
    expect(mockWithCIOAndroid).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      baseProps.android,
      undefined,
      undefined,
      liveNotifications,
      undefined
    );
  });

  // Auto initialization registers types from `config.liveNotifications`. Enabling the build-time
  // setup without it generates the widget and the plist key but never adds the native module, so
  // nothing is registered for push-to-start.
  it('warns when enabled alongside a config that omits liveNotifications', () => {
    mockIsExpo53.mockReturnValue(true);

    withCustomerIOPlugin(baseConfig, {
      ...baseProps,
      config: { cdpApiKey: 'key' },
      liveNotifications: { enabled: true },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/config\.liveNotifications is missing/),
    );
  });

  it('does not warn when the config declares liveNotifications', () => {
    mockIsExpo53.mockReturnValue(true);

    withCustomerIOPlugin(baseConfig, {
      ...baseProps,
      config: { cdpApiKey: 'key', liveNotifications: { types: [] } },
      liveNotifications: { enabled: true },
    });

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/config\.liveNotifications is missing/),
    );
  });

  // The JavaScript initialization path: no `config` at all, so `enabled` is the only way to ask for
  // the native artifacts and there is nothing to warn about.
  it('does not warn when there is no config at all', () => {
    mockIsExpo53.mockReturnValue(true);

    withCustomerIOPlugin(baseConfig, { ...baseProps, liveNotifications: { enabled: true } });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  // The build-time artifacts and the generated native registration come from different inputs, so
  // they have to be reconciled before the platform mods run. Leaving `config.liveNotifications` in
  // place while `enabled: false` removes the pod subspec emits Swift that imports an unlinked module.
  it('strips config.liveNotifications from both platforms when enabled is false', () => {
    mockIsExpo53.mockReturnValue(true);

    withCustomerIOPlugin(baseConfig, {
      ...baseProps,
      config: { cdpApiKey: 'key', liveNotifications: { types: ['io.customer.livenotifications.segments'] } },
      liveNotifications: { enabled: false },
    });

    const iosSdkConfig = mockWithCIOIos.mock.calls[0][1];
    const androidSdkConfig = mockWithCIOAndroid.mock.calls[0][1];

    expect(iosSdkConfig?.liveNotifications).toBeUndefined();
    expect(androidSdkConfig?.liveNotifications).toBeUndefined();
    // Only Live Notifications is dropped — the rest of the config still has to reach the mods.
    expect(iosSdkConfig?.cdpApiKey).toBe('key');
    expect(androidSdkConfig?.cdpApiKey).toBe('key');
  });

  it('leaves config.liveNotifications intact when the feature is on', () => {
    mockIsExpo53.mockReturnValue(true);

    const liveNotificationsConfig = { types: ['io.customer.livenotifications.segments'] };
    withCustomerIOPlugin(baseConfig, {
      ...baseProps,
      config: { cdpApiKey: 'key', liveNotifications: liveNotificationsConfig },
    });

    expect(mockWithCIOIos.mock.calls[0][1]?.liveNotifications).toEqual(liveNotificationsConfig);
    expect(mockWithCIOAndroid.mock.calls[0][1]?.liveNotifications).toEqual(liveNotificationsConfig);
  });
});

describe('withCustomerIOPlugin firebaseInstallationId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsExpo53.mockReturnValue(true);
    mockWithExpoVersion.mockImplementation((c) => c);
    mockWithCIOIos.mockImplementation((c) => c);
    mockWithCIOAndroid.mockImplementation((c) => c as ExpoConfig);
  });

  it('forwards firebaseInstallationId to both platform mods', () => {
    const firebaseInstallationId = { enabled: true };
    withCustomerIOPlugin(baseConfig, { ...baseProps, firebaseInstallationId });

    expect(mockWithCIOIos).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      baseProps.ios,
      undefined,
      undefined,
      undefined,
      firebaseInstallationId
    );
    expect(mockWithCIOAndroid).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      baseProps.android,
      undefined,
      undefined,
      undefined,
      firebaseInstallationId
    );
  });
});

describe('withCustomerIOPlugin secret key guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsExpo53.mockReturnValue(true);
    mockWithExpoVersion.mockImplementation((c) => c);
    mockWithCIOIos.mockImplementation((c) => c);
    mockWithCIOAndroid.mockImplementation((c) => c as ExpoConfig);
  });

  it('fails the build when config.cdpApiKey is an sk_ key', () => {
    expect(() =>
      withCustomerIOPlugin(baseConfig, {
        ...baseProps,
        config: { cdpApiKey: 'sk_us_secret' },
      })
    ).toThrow(/config\.cdpApiKey is a secret key \(sk_\).*public key \(pk_\)/);
    expect(mockWithCIOIos).not.toHaveBeenCalled();
    expect(mockWithCIOAndroid).not.toHaveBeenCalled();
  });

  it('fails the build when the notification service extension env key is an sk_ key', () => {
    expect(() =>
      withCustomerIOPlugin(baseConfig, {
        ...baseProps,
        ios: { iosPath: 'ios', pushNotification: { env: { cdpApiKey: 'sk_eu_secret' } } },
      })
    ).toThrow(/ios\.pushNotification\.env\.cdpApiKey is a secret key \(sk_\)/);
    expect(mockWithCIOIos).not.toHaveBeenCalled();
  });

  it('catches an sk_ key with leading spaces', () => {
    expect(() =>
      withCustomerIOPlugin(baseConfig, {
        ...baseProps,
        config: { cdpApiKey: '  sk_us_secret' },
      })
    ).toThrow(/secret key/);
  });

  it('does not put the key in the error message', () => {
    expect(() =>
      withCustomerIOPlugin(baseConfig, {
        ...baseProps,
        config: { cdpApiKey: 'sk_us_do_not_print' },
      })
    ).toThrow(expect.objectContaining({ message: expect.not.stringContaining('do_not_print') }));
  });

  it.each(['pk_us_public', 'pk_eu_public', 'legacy-write-key'])(
    'accepts %s',
    (cdpApiKey) => {
      expect(() =>
        withCustomerIOPlugin(baseConfig, {
          ...baseProps,
          config: { cdpApiKey },
          ios: { iosPath: 'ios', pushNotification: { env: { cdpApiKey } } },
        })
      ).not.toThrow();
    }
  );
});
