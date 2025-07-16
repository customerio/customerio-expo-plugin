import type { ConfigPlugin } from '@expo/config-plugins';
import { withAndroidManifest } from '@expo/config-plugins';
import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';

import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';

export const withNotificationChannelMetadata: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (config, props) => {
  return withAndroidManifest(config, (manifestProps) => {
    const application = manifestProps.modResults.manifest.application as ManifestApplication[];
    const channel = props.pushNotification?.channel;

    // Only proceed if channel configuration exists
    if (channel && (channel.id || channel.name || channel.importance !== undefined)) {
      if (!application[0]['meta-data']) {
        application[0]['meta-data'] = [];
      }

      if (channel.id) {
        const hasChannelIdMetadata = application[0]['meta-data'].some(
          (metadata) => metadata['$']['android:name'] === 'io.customer.notification_channel_id'
        );

        if (!hasChannelIdMetadata) {
          application[0]['meta-data'].push({
            '$': {
              'android:name': 'io.customer.notification_channel_id',
              'android:value': channel.id,
            },
          });
        }
      }

      if (channel.name) {
        const hasChannelNameMetadata = application[0]['meta-data'].some(
          (metadata) => metadata['$']['android:name'] === 'io.customer.notification_channel_name'
        );

        if (!hasChannelNameMetadata) {
          application[0]['meta-data'].push({
            '$': {
              'android:name': 'io.customer.notification_channel_name',
              'android:value': channel.name,
            },
          });
        }
      }

      if (channel.importance !== undefined) {
        const hasChannelImportanceMetadata = application[0]['meta-data'].some(
          (metadata) => metadata['$']['android:name'] === 'io.customer.notification_channel_importance'
        );

        if (!hasChannelImportanceMetadata) {
          application[0]['meta-data'].push({
            '$': {
              'android:name': 'io.customer.notification_channel_importance',
              'android:value': String(channel.importance),
            },
          });
        }
      }
    }

    manifestProps.modResults.manifest.application = application;
    return manifestProps;
  });
};