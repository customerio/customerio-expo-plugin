import type { ExpoConfig } from '@expo/config-types';
import { withAndroidManifest } from '@expo/config-plugins';
import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';
import {
  FIREBASE_INSTALLATION_ID_METADATA_NAME,
  withFirebaseInstallationIdMetadata,
} from '../../plugin/src/android/withFirebaseInstallationIdMetadata';

jest.mock('@expo/config-plugins');

const mockWithAndroidManifest = withAndroidManifest as jest.MockedFunction<
  typeof withAndroidManifest
>;

const config = { name: 'Test', slug: 'test' } as ExpoConfig;

describe('withFirebaseInstallationIdMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [true, 1],
    [false, 0],
  ])('applies enabled=%s to the main application', (enabled, count) => {
    const application = { $: {} } as ManifestApplication;
    mockWithAndroidManifest.mockImplementation((c, modifier) => {
      modifier({ modResults: { manifest: { application: [application] } } } as never);
      return c;
    });

    withFirebaseInstallationIdMetadata(config, { enabled });

    expect(
      application['meta-data']?.filter(
        (item) => item.$['android:name'] === FIREBASE_INSTALLATION_ID_METADATA_NAME
      )
    ).toHaveLength(count);
  });

  it('leaves the manifest untouched when the option is missing', () => {
    withFirebaseInstallationIdMetadata(config, undefined);
    withFirebaseInstallationIdMetadata(config, {});

    expect(mockWithAndroidManifest).not.toHaveBeenCalled();
  });
});
