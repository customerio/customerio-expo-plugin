import type { ExpoConfig } from '@expo/config-types';

import type {
  CustomerIOPluginOptionsAndroid,
  CustomerIOPluginLiveNotificationsOptions,
  CustomerIOPluginLocationOptions,
  CustomerIOPluginGeofenceOptions,
  NativeSDKConfig,
} from '../types/cio-types';
import { withAndroidManifestUpdates } from './withAndroidManifestUpdates';
import { withAppGoogleServices } from './withAppGoogleServices';
import { withGeofenceGradleProperties } from './withGeofenceGradleProperties';
import { withGoogleServicesJSON } from './withGoogleServicesJSON';
import { withLiveNotificationCallbackRegistration } from './withLiveNotificationCallbackRegistration';
import { withLiveNotificationCustomRenderer } from './withLiveNotificationCustomRenderer';
import { withLiveNotificationLogo } from './withLiveNotificationLogo';
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
  geofence?: CustomerIOPluginGeofenceOptions,
  liveNotifications?: CustomerIOPluginLiveNotificationsOptions,
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
    config = withMainApplicationModifications(config, {
      sdkConfig,
      location,
      geofence,
      liveNotifications,
    });
  } else {
    // Only for JavaScript-initialized apps. With automatic initialization the generated initializer
    // sets the render callback on the push config itself, so registering the wrapper's static too
    // would be dead code — that path never reads it.
    config = withLiveNotificationCallbackRegistration(config, liveNotifications);
  }

  // Outside the `sdkConfig` split on purpose, exactly like the branding logo: both paths above name
  // the app's renderer class in generated Kotlin, and neither compiles unless the file is copied in.
  config = withLiveNotificationCustomRenderer(config, {
    liveNotifications,
    sdkLiveNotifications: sdkConfig?.liveNotifications,
  });

  // Outside the `sdkConfig` block on purpose: a local branding logo has to become a drawable even
  // when the app initializes from JavaScript, because the branding it passes to `CustomerIO.initialize`
  // names that drawable and nothing else would put it in the project.
  //
  // Deliberately not gated on `isLiveNotificationsEnabled` either: that flag decides whether to
  // generate the *iOS* build-time artifacts, and Android needs none of them. An Android app can use
  // Live Notifications entirely from JavaScript without ever setting it, so requiring it here would
  // reintroduce the missing-drawable gap on exactly the path this is meant to cover.
  if (liveNotifications?.branding) {
    config = withLiveNotificationLogo(config, liveNotifications.branding);
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

  // Enable SDK geofence module when geofence.enabled is true (geofence implies location).
  if (geofence?.enabled === true) {
    config = withGeofenceGradleProperties(config, { geofence });
  }

  return config;
}
