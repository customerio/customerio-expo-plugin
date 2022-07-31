import { ConfigPlugin } from '@expo/config-plugins';

import { CustomerIOPluginOptions } from '../types/cio-types';
import { withCustomerIOPod } from './withPodfileModification';
import { withCioXcodeProject } from './withXcodeProject';

export function withCIOIos(
  config,
  props: CustomerIOPluginOptions,
): ConfigPlugin<CustomerIOPluginOptions> {
  withCustomerIOPod(config, props);
  withCioXcodeProject(config, props);
  return config;
}
