import type { ExpoConfig } from '@expo/config-types';

import type {
  CustomerIOPluginOptionsAndroid,
  CustomerIOPluginLocationOptions,
  NativeSDKConfig,
} from '../types/cio-types';
import { withAndroidManifestUpdates } from './withAndroidManifestUpdates';
import { withAppGoogleServices } from './withAppGoogleServices';
import { withGoogleServicesJSON } from './withGoogleServicesJSON';
import { withLocationGradleProperties } from './withLocationGradleProperties';
import { withMainApplicationModifications } from './withMainApplicationModifications';
import { withNotificationChannelMetadata } from './withNotificationChannelMetadata';
import { withProjectBuildGradle } from './withProjectBuildGradle';
import { withProjectGoogleServices } from './withProjectGoogleServices';
import { withProjectStrings } from './withProjectStrings';

export function withCIOAndroid(
  config: ExpoConfig,
  sdkConfig?: NativeSDKConfig,
  props?: CustomerIOPluginOptionsAndroid,
  location?: CustomerIOPluginLocationOptions,
): ExpoConfig {
  // Only run notification setup if props are provided
  if (props) {
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
    config = withMainApplicationModifications(config, { sdkConfig, location });
  }

  // Update project strings for user agent metadata
  config = withProjectStrings(config);

  // Add dependency resolution strategy for Expo SDK 53 compatibility
  // This prevents androidx versions that require API 36 from being pulled in
  config = withProjectBuildGradle(config, props);

  // Enable SDK location module when location.enabled is true
  if (location?.enabled === true) {
    config = withLocationGradleProperties(config, { location });
  }

  return config;
}
