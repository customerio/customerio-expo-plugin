import { ConfigPlugin } from '@expo/config-plugins';

import { withCIOAndroid } from './android/withCIOAndroid';
import { withCIOIos } from './ios/withCIOIos';

// Entry point for config plugin
function withCustomerIOPlugin(config, props): ConfigPlugin<CIOConfigProps> {
  config = withCIOIos(config, props);
  config = withCIOAndroid(config, props);

  return config;
}

export default withCustomerIOPlugin;
