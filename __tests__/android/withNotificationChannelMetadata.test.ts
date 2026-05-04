import { withAndroidManifest } from '@expo/config-plugins';
import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';
import {
  addMetadataIfNotExists,
  withNotificationChannelMetadata,
} from '../../plugin/src/android/withNotificationChannelMetadata';

jest.mock('@expo/config-plugins');

const mockWithAndroidManifest = withAndroidManifest as jest.MockedFunction<
  typeof withAndroidManifest
>;

const makeApplication = (): ManifestApplication =>
  ({
    $: { 'android:name': '.MainApplication' },
  } as ManifestApplication);

describe('addMetadataIfNotExists', () => {
  it('appends a new <meta-data> entry when none exists', () => {
    const app = makeApplication();
    addMetadataIfNotExists(app, 'io.customer.test_key', 'value-1');
    expect(app['meta-data']).toHaveLength(1);
    expect(app['meta-data']![0].$).toEqual({
      'android:name': 'io.customer.test_key',
      'android:value': 'value-1',
    });
  });

  it('does not duplicate when the same name is already present', () => {
    const app = makeApplication();
    addMetadataIfNotExists(app, 'io.customer.test_key', 'value-1');
    addMetadataIfNotExists(app, 'io.customer.test_key', 'value-2');
    expect(app['meta-data']).toHaveLength(1);
    // Pre-existing value is preserved (function is "if not exists", not "upsert")
    expect(app['meta-data']![0].$['android:value']).toEqual('value-1');
  });

  it('initializes the meta-data array when missing', () => {
    const app = { $: {} } as ManifestApplication;
    expect((app as { 'meta-data'?: unknown })['meta-data']).toBeUndefined();
    addMetadataIfNotExists(app, 'io.customer.x', 'y');
    expect(app['meta-data']).toHaveLength(1);
  });
});

describe('withNotificationChannelMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const runWrapperWithChannel = (
    channel: { id?: string; name?: string; importance?: number } | undefined,
  ) => {
    const application = makeApplication();
    const mockConfig = {
      modResults: { manifest: { application: [application] } },
    };
    mockWithAndroidManifest.mockImplementation((config, modifier) => {
      modifier(mockConfig as any);
      return config;
    });

    withNotificationChannelMetadata({} as any, {
      androidPath: '/test',
      pushNotification: channel ? { channel } : undefined,
    });

    return application;
  };

  it('writes id, name, and importance meta-data entries when all three are configured', () => {
    const app = runWrapperWithChannel({
      id: 'cio-default',
      name: 'Customer.io',
      importance: 4,
    });
    const names = (app['meta-data'] ?? []).map((m) => m.$['android:name']);
    expect(names).toEqual(
      expect.arrayContaining([
        'io.customer.notification_channel_id',
        'io.customer.notification_channel_name',
        'io.customer.notification_channel_importance',
      ]),
    );
    const importance = (app['meta-data'] ?? []).find(
      (m) => m.$['android:name'] === 'io.customer.notification_channel_importance',
    );
    expect(importance?.$['android:value']).toEqual('4');
  });

  it('writes only the configured subset', () => {
    const app = runWrapperWithChannel({ id: 'cio-default' });
    const names = (app['meta-data'] ?? []).map((m) => m.$['android:name']);
    expect(names).toEqual(['io.customer.notification_channel_id']);
  });

  it('is a no-op when no channel configuration is provided', () => {
    const app = runWrapperWithChannel(undefined);
    expect(app['meta-data']).toBeUndefined();
  });
});
