import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';
import {
  addResourceMetadataIfNotExists,
  resolveNotificationColor,
  resolveNotificationIcon,
  FIREBASE_NOTIFICATION_COLOR_METADATA,
  FIREBASE_NOTIFICATION_ICON_METADATA,
  NOTIFICATION_COLOR_RESOURCE,
  NOTIFICATION_ICON_ASSET,
} from '../../../plugin/src/android/withNotificationIconAndColor';
import { getFixturePath } from '../../utils';

const freshApplication = (): ManifestApplication =>
  ({
    $: { 'android:name': '.MainApplication' },
  } as unknown as ManifestApplication);

describe('android scenarios: addResourceMetadataIfNotExists (notification icon and color)', () => {
  it('appends a meta-data entry referencing a resource, not a value', () => {
    const application = freshApplication();
    addResourceMetadataIfNotExists(
      application,
      FIREBASE_NOTIFICATION_ICON_METADATA,
      '@drawable/ic_stat_notification'
    );
    expect(application['meta-data']).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": "com.google.firebase.messaging.default_notification_icon",
            "android:resource": "@drawable/ic_stat_notification",
          },
        },
      ]
    `);
  });

  it('appends both Firebase icon and color entries', () => {
    const application = freshApplication();
    addResourceMetadataIfNotExists(
      application,
      FIREBASE_NOTIFICATION_ICON_METADATA,
      `@drawable/${NOTIFICATION_ICON_ASSET}`
    );
    addResourceMetadataIfNotExists(
      application,
      FIREBASE_NOTIFICATION_COLOR_METADATA,
      `@color/${NOTIFICATION_COLOR_RESOURCE}`
    );
    expect(application['meta-data']).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": "com.google.firebase.messaging.default_notification_icon",
            "android:resource": "@drawable/cio_notification_icon",
          },
        },
        {
          "$": {
            "android:name": "com.google.firebase.messaging.default_notification_color",
            "android:resource": "@color/cio_notification_color",
          },
        },
      ]
    `);
  });

  it('does not duplicate when the same name is added twice (and preserves the first resource)', () => {
    const application = freshApplication();
    addResourceMetadataIfNotExists(
      application,
      FIREBASE_NOTIFICATION_ICON_METADATA,
      '@drawable/first'
    );
    addResourceMetadataIfNotExists(
      application,
      FIREBASE_NOTIFICATION_ICON_METADATA,
      '@drawable/second'
    );
    expect(application['meta-data']).toHaveLength(1);
    expect(application['meta-data']![0].$['android:resource']).toEqual(
      '@drawable/first'
    );
  });

  it('initializes the meta-data array when missing', () => {
    const application = freshApplication();
    expect(
      (application as { 'meta-data'?: unknown })['meta-data']
    ).toBeUndefined();
    addResourceMetadataIfNotExists(
      application,
      FIREBASE_NOTIFICATION_ICON_METADATA,
      '@drawable/ic_stat_notification'
    );
    expect(application['meta-data']).toHaveLength(1);
  });

  it('is idempotent: applying the same pair twice equals applying it once', () => {
    const apply = (app: ManifestApplication) => {
      addResourceMetadataIfNotExists(
        app,
        FIREBASE_NOTIFICATION_ICON_METADATA,
        `@drawable/${NOTIFICATION_ICON_ASSET}`
      );
      addResourceMetadataIfNotExists(
        app,
        FIREBASE_NOTIFICATION_COLOR_METADATA,
        `@color/${NOTIFICATION_COLOR_RESOURCE}`
      );
    };
    const onceApp = freshApplication();
    apply(onceApp);
    const twiceApp = JSON.parse(JSON.stringify(onceApp)) as ManifestApplication;
    apply(twiceApp);
    expect(twiceApp).toEqual(onceApp);
  });
});

describe('android scenarios: resolveNotificationColor', () => {
  it('passes an existing color resource reference through untouched', () => {
    expect(resolveNotificationColor('@color/notification_accent')).toEqual({
      resource: '@color/notification_accent',
    });
  });

  it('resolves a hex color to the plugin-owned color resource with the value to write', () => {
    expect(resolveNotificationColor('#1DA1F2')).toEqual({
      resource: `@color/${NOTIFICATION_COLOR_RESOURCE}`,
      value: '#1DA1F2',
    });
  });

  it('throws on a malformed color so prebuild fails with a clear message', () => {
    expect(() => resolveNotificationColor('red')).toThrow(
      /pushNotification\.color/
    );
    expect(() => resolveNotificationColor('#12345')).toThrow(
      /pushNotification\.color/
    );
  });
});

describe('android scenarios: resolveNotificationIcon', () => {
  it('passes an existing drawable resource reference through untouched', () => {
    expect(resolveNotificationIcon('@drawable/ic_stat_name', '/nonexistent')).toEqual({
      resource: '@drawable/ic_stat_name',
    });
  });

  it('resolves a local image path to the plugin-owned drawable plus the file to copy', () => {
    const fixture = getFixturePath('android', 'notification_icon.png');
    const resolved = resolveNotificationIcon(fixture, '/nonexistent');
    expect(resolved).toEqual({
      resource: `@drawable/${NOTIFICATION_ICON_ASSET}`,
      sourcePath: fixture,
    });
  });

  it('resolves a project-relative path against the project root', () => {
    const fixturesRoot = getFixturePath('android', 'notification_icon.png')
      .replace(/\/notification_icon\.png$/, '');
    const resolved = resolveNotificationIcon(
      './notification_icon.png',
      fixturesRoot
    );
    expect(resolved?.sourcePath).toEqual(
      `${fixturesRoot}/notification_icon.png`
    );
  });

  it('returns null when the file does not exist', () => {
    expect(
      resolveNotificationIcon('./missing-icon.png', '/nonexistent')
    ).toBeNull();
  });
});
