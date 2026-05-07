import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';
import { modifyAndroidManifestApplication } from '../../../plugin/src/android/withAndroidManifestUpdates';

const CIO_SERVICE =
  'io.customer.messagingpush.CustomerIOFirebaseMessagingService';
const FIREBASE_ACTION = 'com.google.firebase.MESSAGING_EVENT';

// Minimal-but-viable parsed AndroidManifest.application — `$` plus an optional service array
// is what `application[0]` looks like inside `modResults.manifest.application` after the
// AndroidManifest XML parse step in @expo/config-plugins.
const freshApplication = (): ManifestApplication[] =>
  [
    { $: { 'android:name': '.MainApplication' } },
  ] as unknown as ManifestApplication[];

const applicationWithExistingService = (
  priority?: string
): ManifestApplication[] => {
  const intentFilter: Record<string, unknown> = {
    action: [{ $: { 'android:name': FIREBASE_ACTION } }],
  };
  if (priority !== undefined) intentFilter.$ = { 'android:priority': priority };
  return [
    {
      $: { 'android:name': '.MainApplication' },
      service: [
        {
          '$': { 'android:name': CIO_SERVICE, 'android:exported': 'false' },
          'intent-filter': [intentFilter],
        },
      ],
    },
  ] as unknown as ManifestApplication[];
};

describe('android scenarios — modifyAndroidManifestApplication (FCM service)', () => {
  it('adds the FCM service without a priority attribute when setHighPriorityPushHandler is unset', () => {
    expect(
      modifyAndroidManifestApplication(freshApplication(), { androidPath: '' })
    ).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": ".MainApplication",
          },
          "service": [
            {
              "$": {
                "android:exported": "false",
                "android:name": "io.customer.messagingpush.CustomerIOFirebaseMessagingService",
              },
              "intent-filter": [
                {
                  "action": [
                    {
                      "$": {
                        "android:name": "com.google.firebase.MESSAGING_EVENT",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]
    `);
  });

  it('adds the FCM service without a priority attribute when setHighPriorityPushHandler is true', () => {
    expect(
      modifyAndroidManifestApplication(freshApplication(), {
        androidPath: '',
        setHighPriorityPushHandler: true,
      })
    ).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": ".MainApplication",
          },
          "service": [
            {
              "$": {
                "android:exported": "false",
                "android:name": "io.customer.messagingpush.CustomerIOFirebaseMessagingService",
              },
              "intent-filter": [
                {
                  "action": [
                    {
                      "$": {
                        "android:name": "com.google.firebase.MESSAGING_EVENT",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]
    `);
  });

  it('adds the FCM service with priority="-10" when setHighPriorityPushHandler is false', () => {
    expect(
      modifyAndroidManifestApplication(freshApplication(), {
        androidPath: '',
        setHighPriorityPushHandler: false,
      })
    ).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": ".MainApplication",
          },
          "service": [
            {
              "$": {
                "android:exported": "false",
                "android:name": "io.customer.messagingpush.CustomerIOFirebaseMessagingService",
              },
              "intent-filter": [
                {
                  "$": {
                    "android:priority": "-10",
                  },
                  "action": [
                    {
                      "$": {
                        "android:name": "com.google.firebase.MESSAGING_EVENT",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]
    `);
  });

  it('removes a stale priority attribute on an existing CIO service when setHighPriorityPushHandler is true', () => {
    expect(
      modifyAndroidManifestApplication(applicationWithExistingService('-5'), {
        androidPath: '',
        setHighPriorityPushHandler: true,
      })
    ).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": ".MainApplication",
          },
          "service": [
            {
              "$": {
                "android:exported": "false",
                "android:name": "io.customer.messagingpush.CustomerIOFirebaseMessagingService",
              },
              "intent-filter": [
                {
                  "$": {},
                  "action": [
                    {
                      "$": {
                        "android:name": "com.google.firebase.MESSAGING_EVENT",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]
    `);
  });

  it('updates the priority attribute on an existing CIO service to "-10" when setHighPriorityPushHandler is false', () => {
    expect(
      modifyAndroidManifestApplication(applicationWithExistingService(), {
        androidPath: '',
        setHighPriorityPushHandler: false,
      })
    ).toMatchInlineSnapshot(`
      [
        {
          "$": {
            "android:name": ".MainApplication",
          },
          "service": [
            {
              "$": {
                "android:exported": "false",
                "android:name": "io.customer.messagingpush.CustomerIOFirebaseMessagingService",
              },
              "intent-filter": [
                {
                  "$": {
                    "android:priority": "-10",
                  },
                  "action": [
                    {
                      "$": {
                        "android:name": "com.google.firebase.MESSAGING_EVENT",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]
    `);
  });

  it('initializes the service array when application[0].service is missing', () => {
    const result = modifyAndroidManifestApplication(freshApplication(), {
      androidPath: '',
    });
    expect(result[0].service).toBeDefined();
    expect(result[0].service).toHaveLength(1);
    expect(result[0].service?.[0].$['android:name']).toBe(CIO_SERVICE);
  });

  it('is idempotent — applying twice equals applying once (default priority)', () => {
    const once = modifyAndroidManifestApplication(freshApplication(), {
      androidPath: '',
    });
    const twice = modifyAndroidManifestApplication(
      JSON.parse(JSON.stringify(once)),
      { androidPath: '' }
    );
    expect(twice).toEqual(once);
  });

  it('is idempotent when setHighPriorityPushHandler is true', () => {
    const once = modifyAndroidManifestApplication(freshApplication(), {
      androidPath: '',
      setHighPriorityPushHandler: true,
    });
    const twice = modifyAndroidManifestApplication(
      JSON.parse(JSON.stringify(once)),
      { androidPath: '', setHighPriorityPushHandler: true }
    );
    expect(twice).toEqual(once);
  });

  it('is idempotent when setHighPriorityPushHandler is false', () => {
    const once = modifyAndroidManifestApplication(freshApplication(), {
      androidPath: '',
      setHighPriorityPushHandler: false,
    });
    const twice = modifyAndroidManifestApplication(
      JSON.parse(JSON.stringify(once)),
      { androidPath: '', setHighPriorityPushHandler: false }
    );
    expect(twice).toEqual(once);
  });
});
