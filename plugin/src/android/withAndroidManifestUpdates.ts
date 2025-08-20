import type { ConfigPlugin } from '@expo/config-plugins';
import { withAndroidManifest } from '@expo/config-plugins';
import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';

import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';

export const withAndroidManifestUpdates: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter, options) => {
  return withAndroidManifest(configOuter, (props) => {
    const application = props.modResults.manifest
      .application as ManifestApplication[];
    const customerIOMessagingpush =
      'io.customer.messagingpush.CustomerIOFirebaseMessagingService';

    if (!application[0]['service']) {
      application[0]['service'] = [];
    }

    const hasService = application[0]['service'].some(
      (service) => service['$']['android:name'] === customerIOMessagingpush
    );

    if (!hasService) {
      const priority = options?.pushNotification?.firebaseMessagingServicePriority;
      
      const intentFilter: any = {
        action: [
          {
            $: {
              'android:name': 'com.google.firebase.MESSAGING_EVENT',
            },
          },
        ],
      };

      // Only add priority if explicitly provided
      if (priority !== undefined) {
        intentFilter.$ = {
          'android:priority': priority.toString(),
        };
      }

      application[0]['service'].push({
        '$': {
          'android:name': customerIOMessagingpush,
          'android:exported': 'false',
        },
        'intent-filter': [intentFilter],
      });
      
      const priorityMessage = priority !== undefined ? ` with priority ${priority}` : '';
      console.log(
        `Successfully set CustomerIO push handler${priorityMessage} in AndroidManifest.xml`
      );
    }

    props.modResults.manifest.application = application;
    return props;
  });
};
