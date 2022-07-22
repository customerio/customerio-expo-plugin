import { ConfigPlugin } from '@expo/config-plugins';

import { withCustomerIOPod } from './withPodfileModification';

export function withCIOIos(config, props): ConfigPlugin<CIOConfigProps> {
  withCustomerIOPod(config, props);
  return config;
}
