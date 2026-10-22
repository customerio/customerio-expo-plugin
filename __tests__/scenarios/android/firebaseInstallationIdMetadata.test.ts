import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';
import { applyFirebaseInstallationIdMetadata } from '../../../plugin/src/android/withFirebaseInstallationIdMetadata';

const application = (
  metadata?: { name: string; value: string }[]
): ManifestApplication =>
  ({
    $: { 'android:name': '.MainApplication' },
    ...(metadata && {
      'meta-data': metadata.map(({ name, value }) => ({
        $: { 'android:name': name, 'android:value': value },
      })),
    }),
  } as unknown as ManifestApplication);

const fid = 'firebase_messaging_installation_id_enabled';
const other = { name: 'io.customer.notification_channel_id', value: 'cio' };

describe('android scenarios — applyFirebaseInstallationIdMetadata', () => {
  it('adds the meta-data to a fresh application when enabled', () => {
    expect(
      applyFirebaseInstallationIdMetadata(application(), true)['meta-data']
    ).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": "firebase_messaging_installation_id_enabled",
            "android:value": "true",
          },
        },
      ]
    `);
  });

  it('replaces an existing false value and keeps other entries when enabled', () => {
    expect(
      applyFirebaseInstallationIdMetadata(
        application([other, { name: fid, value: 'false' }]),
        true
      )['meta-data']
    ).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": "io.customer.notification_channel_id",
            "android:value": "cio",
          },
        },
        {
          "$": {
            "android:name": "firebase_messaging_installation_id_enabled",
            "android:value": "true",
          },
        },
      ]
    `);
  });

  it('removes the meta-data and keeps other entries when disabled', () => {
    expect(
      applyFirebaseInstallationIdMetadata(
        application([other, { name: fid, value: 'true' }]),
        false
      )['meta-data']
    ).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": "io.customer.notification_channel_id",
            "android:value": "cio",
          },
        },
      ]
    `);
  });

  it('is idempotent', () => {
    const once = applyFirebaseInstallationIdMetadata(application(), true);
    const twice = applyFirebaseInstallationIdMetadata(
      JSON.parse(JSON.stringify(once)),
      true
    );
    expect(twice).toEqual(once);
  });
});
