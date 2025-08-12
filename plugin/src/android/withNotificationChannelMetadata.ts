import type { ConfigPlugin } from '@expo/config-plugins';
import { withAndroidManifest } from '@expo/config-plugins';
import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';

import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';

/**
 * Adds a metadata entry to the Android manifest if it doesn't already exist
 */
const addMetadataIfNotExists = (
  application: ManifestApplication,
  name: string,
  value: string
): void => {
  // Initialize meta-data array if it doesn't exist
  if (!application['meta-data']) {
    application['meta-data'] = [];
  }

  // Check if metadata already exists
  const hasMetadata = application['meta-data'].some(
    (metadata) => metadata.$['android:name'] === name
  );

  // Add metadata if it doesn't exist
  if (!hasMetadata) {
    application['meta-data'].push({
      $: {
        'android:name': name,
        'android:value': value,
      },
    });
  }
};

export const withNotificationChannelMetadata: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (config, props) => {
  return withAndroidManifest(config, (manifestProps) => {
    const application = manifestProps.modResults.manifest
      .application as ManifestApplication[];
    const channel = props.pushNotification?.channel;

    // Only proceed if channel configuration exists
    if (
      channel &&
      (channel.id || channel.name || channel.importance !== undefined)
    ) {
      if (channel.id) {
        addMetadataIfNotExists(
          application[0],
          'io.customer.notification_channel_id',
          channel.id
        );
      }

      if (channel.name) {
        addMetadataIfNotExists(
          application[0],
          'io.customer.notification_channel_name',
          channel.name
        );
      }

      if (channel.importance !== undefined) {
        addMetadataIfNotExists(
          application[0],
          'io.customer.notification_channel_importance',
          String(channel.importance)
        );
      }
    }

    manifestProps.modResults.manifest.application = application;
    return manifestProps;
  });
};
