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
      geofence
    );
    expect(mockWithCIOAndroid).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      baseProps.android,
      undefined,
      geofence
    );
  });

  it('does not throw when geofence is disabled on Expo < 53', () => {
    mockIsExpo53.mockReturnValue(false);

    expect(() =>
      withCustomerIOPlugin(baseConfig, { ...baseProps, geofence: { enabled: false } })
    ).not.toThrow();
  });
});
