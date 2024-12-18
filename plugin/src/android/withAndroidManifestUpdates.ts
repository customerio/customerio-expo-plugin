import { ConfigPlugin, withAndroidManifest } from '@expo/config-plugins';
import type { ManifestApplication, ManifestMetaData } from '@expo/config-plugins/build/android/Manifest';
import type { ExpoConfig } from '@expo/config-types';
import { getPluginVersion } from '../helpers/utils/pluginUtils';
import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';

export const withAndroidManifestUpdates: ConfigPlugin<CustomerIOPluginOptionsAndroid> = (
  expoConfig: ExpoConfig,
  pluginProps: CustomerIOPluginOptionsAndroid,
) => {
  return withAndroidManifest(expoConfig, (props) => {
    // Since object and array passed by reference, we don't need to return the updated object
    let application = props.modResults.manifest.application as ManifestApplication[];
    // Add Customer.io Push Handler service to AndroidManifest.xml if setHighPriorityPushHandler is true
    if (pluginProps.setHighPriorityPushHandler) {
      setHighPriorityPushHandlerService(application);
    }
    // Set meta-data for user agent in AndroidManifest.xml
    setUserAgentMetaData(application);
    return props;
  });
};

/**
 * Add Customer.io Push Handler Service to AndroidManifest.xml if not already present.
 */
const setHighPriorityPushHandlerService = (application: ManifestApplication[]) => {
  const customerIOMessagingPush = 'io.customer.messagingpush.CustomerIOFirebaseMessagingService';

  if (!application[0]['service']) {
    application[0]['service'] = [];
  }

  const hasService = application[0]['service'].some(
    (service) => service['$']['android:name'] === customerIOMessagingPush,
  );

  if (!hasService) {
    application[0]['service'].push({
      $: {
        'android:name': customerIOMessagingPush,
        'android:exported': 'false',
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name': 'com.google.firebase.MESSAGING_EVENT',
              },
            },
          ],
        },
      ],
    });
    console.log('Successfully set CustomerIO push handler as priority in AndroidManifest.xml');
  }
};

/**
 * Updates or adds metadata entries in AndroidManifest.xml
 */
const setManifestMetaData = (
  metaData: ManifestMetaData[],
  entries: (ManifestMetaData & { override?: boolean })[],
): ManifestMetaData[] => {
  // Inline function to safely set tools:replace
  const setToolsReplace = (attributes: Record<string, string>): void => {
    (attributes as Record<string, string>)['tools:node'] = 'replace';
  };

  // Update or add each metadata entry
  entries.forEach(({ $: attributes, override }) => {
    const existingMetaData = metaData.find((meta) => meta.$['android:name'] === attributes['android:name']);

    if (existingMetaData) {
      // Update the existing metadata value and add tools:replace if override is true
      existingMetaData.$['android:value'] = attributes['android:value'];

      if (override) {
        setToolsReplace(existingMetaData.$);
      }
    } else {
      // Else, add new metadata
      const newMetaData: ManifestMetaData = {
        $: {
          ...attributes,
        },
      };

      if (override) {
        setToolsReplace(newMetaData.$);
      }

      metaData.push(newMetaData);
    }
  });

  return metaData;
};

/**
 * Sets meta-data for user-agent in AndroidManifest.xml
 * This is required for Customer.io SDK to identify correct source and version for calls made from Android platform.
 */
const setUserAgentMetaData = (application: ManifestApplication[]) => {
  const sdkSourceMetaDataKey = 'io.customer.sdk.android.core.SDK_SOURCE';
  const sdkVersionMetaDataKey = 'io.customer.sdk.android.core.SDK_VERSION';
  const pluginVersion = getPluginVersion();

  // Ensure `meta-data` exists; initialize as an empty array if null or undefined
  application[0]['meta-data'] = application[0]['meta-data'] ?? [];

  const metadataEntries: (ManifestMetaData & { override?: boolean })[] = [
    { $: { 'android:name': sdkSourceMetaDataKey, 'android:value': 'Expo' }, override: true },
    { $: { 'android:name': sdkVersionMetaDataKey, 'android:value': pluginVersion }, override: true },
  ];
  setManifestMetaData(application[0]['meta-data'], metadataEntries);
};
