import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';
import { addMetadataIfNotExists } from '../../../plugin/src/android/withNotificationChannelMetadata';

const freshApplication = (): ManifestApplication =>
  ({
    $: { 'android:name': '.MainApplication' },
  } as unknown as ManifestApplication);

describe('android scenarios — addMetadataIfNotExists (notification channel)', () => {
  it('appends a single channel meta-data entry to a fresh application', () => {
    const application = freshApplication();
    addMetadataIfNotExists(
      application,
      'io.customer.notification_channel_id',
      'cio-default'
    );
    expect(application['meta-data']).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": "io.customer.notification_channel_id",
            "android:value": "cio-default",
          },
        },
      ]
    `);
  });

  it('appends multiple distinct meta-data entries (id, name, importance)', () => {
    const application = freshApplication();
    addMetadataIfNotExists(
      application,
      'io.customer.notification_channel_id',
      'cio-default'
    );
    addMetadataIfNotExists(
      application,
      'io.customer.notification_channel_name',
      'Customer.io'
    );
    addMetadataIfNotExists(
      application,
      'io.customer.notification_channel_importance',
      '4'
    );
    expect(application['meta-data']).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": "io.customer.notification_channel_id",
            "android:value": "cio-default",
          },
        },
        {
          "$": {
            "android:name": "io.customer.notification_channel_name",
            "android:value": "Customer.io",
          },
        },
        {
          "$": {
            "android:name": "io.customer.notification_channel_importance",
            "android:value": "4",
          },
        },
      ]
    `);
  });

  it('does not duplicate when the same name is added twice (and preserves the first value)', () => {
    const application = freshApplication();
    addMetadataIfNotExists(
      application,
      'io.customer.notification_channel_id',
      'first'
    );
    addMetadataIfNotExists(
      application,
      'io.customer.notification_channel_id',
      'second'
    );
    expect(application['meta-data']).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": "io.customer.notification_channel_id",
            "android:value": "first",
          },
        },
      ]
    `);
  });

  it('initializes the meta-data array when missing', () => {
    const application = freshApplication();
    expect(
      (application as { 'meta-data'?: unknown })['meta-data']
    ).toBeUndefined();
    addMetadataIfNotExists(
      application,
      'io.customer.notification_channel_id',
      'cio-default'
    );
    expect(application['meta-data']).toHaveLength(1);
  });

  it('is idempotent — applying the same triple twice equals applying it once', () => {
    const apply = (app: ManifestApplication) => {
      addMetadataIfNotExists(
        app,
        'io.customer.notification_channel_id',
        'cio-default'
      );
      addMetadataIfNotExists(
        app,
        'io.customer.notification_channel_name',
        'Customer.io'
      );
      addMetadataIfNotExists(
        app,
        'io.customer.notification_channel_importance',
        '4'
      );
    };
    const onceApp = freshApplication();
    apply(onceApp);
    const twiceApp = JSON.parse(JSON.stringify(onceApp)) as ManifestApplication;
    apply(twiceApp);
    expect(twiceApp).toEqual(onceApp);
  });
});
