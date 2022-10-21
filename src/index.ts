import type { ExpoConfig } from '@expo/config-types';
import { injectAnalytics } from './analytics/injectAnalytics';

import { withCIOAndroid } from './android/withCIOAndroid';
import { withCIOIos } from './ios/withCIOIos';
import type {
  CustomerIOPluginOptionsIOS,
  CustomerIOPluginOptionsAndroid,
} from './types/cio-types';

// Entry point for config plugin
function withCustomerIOPlugin(
  config: ExpoConfig,
  props: CustomerIOPluginOptionsIOS | CustomerIOPluginOptionsAndroid
) {
  config = withCIOIos(config, props as CustomerIOPluginOptionsIOS);
  config = withCIOAndroid(config, props as CustomerIOPluginOptionsAndroid);
  injectAnalytics();

  return config;
}

export default withCustomerIOPlugin;
