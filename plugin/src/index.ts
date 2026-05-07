import type { ExpoConfig } from '@expo/config-types';

import { withCIOAndroid } from './android/withCIOAndroid';
import { isExpoVersion53OrHigher } from './ios/utils';
import { withCIOIos } from './ios/withCIOIos';
import type {
  CustomerIOPluginOptions,
  LocationTrackingMode,
  NativeSDKConfig,
} from './types/cio-types';
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

  // Belt-and-suspenders write of the plugin version into the RN SDK's
  // package.json. The postinstall hook does the same write at install time;
  // this covers installs where postinstall didn't run cleanly (pnpm with
  // strict store layouts, --ignore-scripts, cached CI installs, etc).
  config = withExpoVersion(config);

  // Apply platform specific modifications
  config = withCIOIos(config, props.config, props.ios, props.location);
  config = withCIOAndroid(config, props.config, props.android, props.location);

  return config;
}

export default withCustomerIOPlugin;
