import { ConfigPlugin } from '@expo/config-plugins';

import { withCustomerIOBuildProperties } from './withBuildProperties';
import { withCustomerIOPod } from './withPodfileModification';
import { withCustomerIOReactBridge } from './withReactNativeBridge';

export function withCIOIos(config, props): ConfigPlugin<CIOConfigProps> {
  withCustomerIOPod(config, props);
  withCustomerIOBuildProperties(config, props);
  withCustomerIOReactBridge(config, props);
  return config;
}
