import { ConfigPlugin } from '@expo/config-plugins';

import { withCIOAndroid } from './android/withCIOAndroid';
import { withCIOIos } from './ios/withCIOIos';
import { CustomerIOPluginOptions } from './types/cio-types';

// Entry point for config plugin
function withCustomerIOPlugin(
  config,
  props: CustomerIOPluginOptions,
): ConfigPlugin<CustomerIOPluginOptions> {
  config = withCIOIos(config, props);
  config = withCIOAndroid(config, props);

  return config;
}

export default withCustomerIOPlugin;
