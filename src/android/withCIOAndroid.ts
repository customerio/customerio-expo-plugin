import { ConfigPlugin } from '@expo/config-plugins';

import { CustomerIOPluginOptions } from '../types/cio-types';

export function withCIOAndroid(
  config,
  props: CustomerIOPluginOptions,
): ConfigPlugin<CustomerIOPluginOptions> {
  return config;
}
