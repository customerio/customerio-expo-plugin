import type { ExpoConfig } from '@expo/config-types';

import { withCIOAndroid } from './android/withCIOAndroid';
import { isExpoVersion53OrHigher } from './ios/utils';
import { withCIOIos } from './ios/withCIOIos';
import type { CustomerIOPluginOptions } from './types/cio-types';

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

  // Validate SDK config if provided
  if (props.config) {
    validateNativeSDKConfig(props.config);
  }

  config = withCIOIos(config, props.config, props.ios);
  config = withCIOAndroid(config, props.config, props.android);

  return config;
}

export default withCustomerIOPlugin;
