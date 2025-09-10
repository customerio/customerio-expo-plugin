import type { ExpoConfig } from '@expo/config-types';

import type { CustomerIOPluginOptionsAndroid, NativeSDKConfig } from '../types/cio-types';
import { withAndroidManifestUpdates } from './withAndroidManifestUpdates';
import { withAppGoogleServices } from './withAppGoogleServices';
import { withGistMavenRepository } from './withGistMavenRepository';
import { withGoogleServicesJSON } from './withGoogleServicesJSON';
import { withMainApplicationModifications } from './withMainApplicationModifications';
import { withNotificationChannelMetadata } from './withNotificationChannelMetadata';
import { withProjectGoogleServices } from './withProjectGoogleServices';
import { withProjectStrings } from './withProjectStrings';

export function withCIOAndroid(
  config: ExpoConfig,
  sdkConfig: NativeSDKConfig | undefined,
  props?: CustomerIOPluginOptionsAndroid
): ExpoConfig {

    config = withProjectStrings(config);
  // Only run notification setup if props are provided
  if(props) {
    config = withGistMavenRepository(config, props);
    config = withProjectGoogleServices(config, props);
    config = withAppGoogleServices(config, props);
    config = withGoogleServicesJSON(config, props);
    if (props.setHighPriorityPushHandler !== undefined) {
      config = withAndroidManifestUpdates(config, props);
    }
    if (props.pushNotification?.channel) {
      config = withNotificationChannelMetadata(config, props);
    }
  }
  // Add auto initialization if sdkConfig is provided
  if (sdkConfig) {
    config = withMainApplicationModifications(config, sdkConfig);
  }

  return config;
}
