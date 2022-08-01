import { ConfigPlugin } from '@expo/config-plugins';

import { CustomerIOPluginOptions } from '../types/cio-types';
import { withCioXcodeProject } from './withXcodeProject';

export function withCIOIos(
  config,
  props: CustomerIOPluginOptions,
): ConfigPlugin<CustomerIOPluginOptions> {
  withCioXcodeProject(config, props);
  return config;
}
