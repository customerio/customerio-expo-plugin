import type { ConfigPlugin } from '@expo/config-plugins';
import { withAndroidManifest } from '@expo/config-plugins';
import type { ManifestApplication } from '@expo/config-plugins/build/android/Manifest';

import type { CustomerIOPluginFirebaseInstallationIdOptions } from '../types/cio-types';

export const FIREBASE_INSTALLATION_ID_METADATA_NAME =
  'firebase_messaging_installation_id_enabled';

export const applyFirebaseInstallationIdMetadata = (
  application: ManifestApplication,
  enabled: boolean
): ManifestApplication => {
  const metadata = (application['meta-data'] ?? []).filter(
    (item) => item.$['android:name'] !== FIREBASE_INSTALLATION_ID_METADATA_NAME
  );

  if (enabled) {
    metadata.push({
      $: {
        'android:name': FIREBASE_INSTALLATION_ID_METADATA_NAME,
        'android:value': 'true',
      },
    });
  }

  application['meta-data'] = metadata;
  return application;
};

/**
 * Sets the Firebase Installation ID opt-in meta-data in the Android manifest when enabled.
 * An explicit `enabled: false` removes it; a missing option leaves the manifest untouched.
 */
export const withFirebaseInstallationIdMetadata: ConfigPlugin<
  CustomerIOPluginFirebaseInstallationIdOptions | undefined
> = (config, firebaseInstallationId) => {
  const enabled = firebaseInstallationId?.enabled;
  if (enabled === undefined) {
    return config;
  }

  return withAndroidManifest(config, (manifestProps) => {
    const application = manifestProps.modResults.manifest
      .application as ManifestApplication[];
    applyFirebaseInstallationIdMetadata(application[0], enabled);
    return manifestProps;
  });
};
