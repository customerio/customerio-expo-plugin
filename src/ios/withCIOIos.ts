import { ConfigPlugin } from '@expo/config-plugins';

import { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { withCioNotificationsXcodeProject } from './withNotificationsXcodeProject';
import { withCioXcodeProject } from './withXcodeProject';

export function withCIOIos(
  config,
  props: CustomerIOPluginOptionsIOS,
): ConfigPlugin<CustomerIOPluginOptionsIOS> {
  config = withCioXcodeProject(config, props);
  config = withCioNotificationsXcodeProject(config, props);

  return config;
}
