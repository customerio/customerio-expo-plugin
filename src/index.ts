import type { ExpoConfig } from '@expo/config-types';
import { withAnalytics } from './analytics/injectAnalytics';

import { withCIOAndroid } from './android/withCIOAndroid';
import { withCIOIos } from './ios/withCIOIos';
import type {
  CustomerIOPluginOptions,
} from './types/cio-types';

// Entry point for config plugin
function withCustomerIOPlugin(
  config: ExpoConfig,
  props: CustomerIOPluginOptions
) {
  if (props.ios) {
    config = withCIOIos(config, props.ios);
  }

  if (props.android) {
    config = withCIOAndroid(config, props.android);
  }

  config = withAnalytics(config, props);

  return config;
}

export default withCustomerIOPlugin;
