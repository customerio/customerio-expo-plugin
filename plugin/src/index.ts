import type { ExpoConfig } from '@expo/config-types';

import { withCIOAndroid } from './android/withCIOAndroid';
import { withCIOIos } from './ios/withCIOIos';
import type { CustomerIOPluginOptions } from './types/cio-types';
import { validateNativeSDKConfig } from './utils/validation';

// Entry point for config plugin
function withCustomerIOPlugin(
  config: ExpoConfig,
  props: CustomerIOPluginOptions
) {
  // Validate SDK config if provided
  if (props.config) {
    validateNativeSDKConfig(props.config);
  }

  if (props.ios) {
    config = withCIOIos(config, props.config, props.ios);
  }

  if (props.android) {
    config = withCIOAndroid(config, props.config, props.android);
  }

  return config;
}

export default withCustomerIOPlugin;
