import type { ExpoConfig } from '@expo/config-types';
import { withInfoPlist } from '@expo/config-plugins';
import {
  FIREBASE_INSTALLATION_ID_PLIST_KEY,
  withFirebaseInstallationIdInfoPlist,
} from '../../plugin/src/ios/withFirebaseInstallationIdInfoPlist';
import type { CustomerIOPluginOptionsIOS } from '../../plugin/src/types/cio-types';
import { logger } from '../../plugin/src/utils/logger';

jest.mock('@expo/config-plugins');
jest.mock('../../plugin/src/utils/logger', () => ({ logger: { warn: jest.fn() } }));

const mockWithInfoPlist = withInfoPlist as jest.MockedFunction<typeof withInfoPlist>;

const config = { name: 'Test', slug: 'test' } as ExpoConfig;
const fcm: CustomerIOPluginOptionsIOS = {
  iosPath: 'ios',
  pushNotification: { provider: 'fcm' },
};

describe('withFirebaseInstallationIdInfoPlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [true, true],
    [false, undefined],
  ])('applies enabled=%s to the Info.plist with FCM', (enabled, expected) => {
    const plist: Record<string, unknown> = {
      [FIREBASE_INSTALLATION_ID_PLIST_KEY]: true,
    };
    mockWithInfoPlist.mockImplementation((c, modifier) => {
      modifier({ modResults: plist } as never);
      return c;
    });

    withFirebaseInstallationIdInfoPlist(config, {
      firebaseInstallationId: { enabled },
      iosOptions: fcm,
    });

    expect(plist[FIREBASE_INSTALLATION_ID_PLIST_KEY]).toBe(expected);
  });

  it('leaves the Info.plist untouched when the option is missing', () => {
    withFirebaseInstallationIdInfoPlist(config, { iosOptions: fcm });
    withFirebaseInstallationIdInfoPlist(config, {
      firebaseInstallationId: {},
      iosOptions: fcm,
    });

    expect(mockWithInfoPlist).not.toHaveBeenCalled();
  });

  it.each([
    ['APN', { iosPath: 'ios', pushNotification: { provider: 'apn' } }],
    ['no push', { iosPath: 'ios' }],
    ['no ios options', undefined],
  ] as [string, CustomerIOPluginOptionsIOS | undefined][])(
    'skips and warns when enabled with %s',
    (_, iosOptions) => {
      withFirebaseInstallationIdInfoPlist(config, {
        firebaseInstallationId: { enabled: true },
        iosOptions,
      });

      expect(mockWithInfoPlist).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('firebaseInstallationId.enabled is ignored on iOS')
      );
    }
  );
});
