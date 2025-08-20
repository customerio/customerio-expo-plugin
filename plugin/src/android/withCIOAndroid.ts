import type { ExpoConfig } from '@expo/config-types';

import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';
import { withAndroidManifestUpdates } from './withAndroidManifestUpdates';
import { withAppGoogleServices } from './withAppGoogleServices';
import { withGistMavenRepository } from './withGistMavenRepository';
import { withGoogleServicesJSON } from './withGoogleServicesJSON';
import { withNotificationChannelMetadata } from './withNotificationChannelMetadata';
import { withProjectGoogleServices } from './withProjectGoogleServices';
import { withProjectStrings } from './withProjectStrings';

export function withCIOAndroid(
  config: ExpoConfig,
  props: CustomerIOPluginOptionsAndroid
): ExpoConfig {
  config = withGistMavenRepository(config, props);
  config = withProjectGoogleServices(config, props);
  config = withAppGoogleServices(config, props);
  config = withGoogleServicesJSON(config, props);
  config = withProjectStrings(config);
  if (props.setHighPriorityPushHandler || props.pushNotification?.firebaseMessagingServicePriority !== undefined) {
    config = withAndroidManifestUpdates(config, props);
  }
  if (props.pushNotification?.channel) {
    config = withNotificationChannelMetadata(config, props);
  }

  return config;
}
