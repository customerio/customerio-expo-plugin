import { ConfigPlugin } from '@expo/config-plugins';

import { withCIOAndroid } from './android/withCIOAndroid';
import { withCIOIos } from './ios/withCIOIos';
import {
  CustomerIOPluginOptionsIOS,
  CustomerIOPluginOptionsAndroid,
} from './types/cio-types';

// Entry point for config plugin
function withCustomerIOPlugin(
  config,
  props: CustomerIOPluginOptionsIOS | CustomerIOPluginOptionsAndroid,
): ConfigPlugin<CustomerIOPluginOptionsIOS | CustomerIOPluginOptionsAndroid> {
  config = withCIOIos(config, props as CustomerIOPluginOptionsIOS);
  config = withCIOAndroid(config, props as CustomerIOPluginOptionsAndroid);

  return config;
}

export default withCustomerIOPlugin;
