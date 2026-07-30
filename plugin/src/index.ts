import type { ExpoConfig } from '@expo/config-types';

import { withCIOAndroid } from './android/withCIOAndroid';
import { isExpoVersion53OrHigher } from './ios/utils';
import { withCIOIos } from './ios/withCIOIos';
import type {
  CustomerIOPluginOptions,
  LocationTrackingMode,
  NativeSDKConfig,
} from './types/cio-types';
import { logger } from './utils/logger';
import { withExpoVersion } from './utils/writeExpoVersion';

export type { LocationTrackingMode, NativeSDKConfig };

// Entry point for config plugin
function withCustomerIOPlugin(
  config: ExpoConfig,
  props: CustomerIOPluginOptions
) {
  // Check if config is being used with unsupported Expo version
  if (props.config && !isExpoVersion53OrHigher(config)) {
    throw new Error(
      'CustomerIO auto initialization (config property) requires Expo SDK 53 or higher. ' +
      'Please upgrade to Expo SDK 53+ or use manual initialization instead. ' +
      'See documentation for manual setup instructions.'
    );
  }

  // Geofence relies on the Swift AppDelegate background-delivery bootstrap, which the
  // plugin only injects on Swift projects (Expo SDK 53+).
  if (props.geofence?.enabled && !isExpoVersion53OrHigher(config)) {
    throw new Error(
      'CustomerIO geofence requires Expo SDK 53 or higher. ' +
      'Please upgrade to Expo SDK 53+ to enable geofence.'
    );
  }

  // Live Notifications needs the Swift AppDelegate to route a tapped activity's URL through the SDK
  // (see `withCIOIosSwift`), which the plugin only injects on Swift projects. Without that guard a
  // pre-53 project would still get the widget target, the Info.plist key and the Podfile subspec,
  // then silently lose tap attribution and deep links.
  if (props.liveNotifications?.enabled && !isExpoVersion53OrHigher(config)) {
    throw new Error(
      'CustomerIO Live Notifications requires Expo SDK 53 or higher. ' +
      'Please upgrade to Expo SDK 53+ to enable Live Notifications.'
    );
  }

  // Auto initialization registers activity types from `config.liveNotifications`. Enabling the
  // build-time setup without it produces an app whose initializer never adds the Live Activities
  // module: nothing is registered for push-to-start, and a JavaScript `start()` has no module to
  // reach. Warn rather than throw — the flag is still the right way to opt in when initializing
  // from JavaScript, which is exactly the case where `config` is absent.
  if (
    props.liveNotifications?.enabled &&
    props.config &&
    !props.config.liveNotifications
  ) {
    logger.warn(
      'liveNotifications.enabled is set and the Customer.io SDK initializes automatically, but ' +
      'config.liveNotifications is missing, so no activity types are registered. Add ' +
      'config.liveNotifications with types and/or customType, or drop liveNotifications.enabled.'
    );
  }

  // Belt-and-suspenders write of the plugin version into the RN SDK's
  // package.json. The postinstall hook does the same write at install time;
  // this covers installs where postinstall didn't run cleanly (pnpm with
  // strict store layouts, --ignore-scripts, cached CI installs, etc).
  config = withExpoVersion(config);

  // Apply platform specific modifications
  config = withCIOIos(config, props.config, props.ios, props.location, props.geofence, props.liveNotifications);
  config = withCIOAndroid(config, props.config, props.android, props.location, props.geofence, props.liveNotifications);

  return config;
}

export default withCustomerIOPlugin;
