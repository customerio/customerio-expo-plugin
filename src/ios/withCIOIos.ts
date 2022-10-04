import { ConfigPlugin } from '@expo/config-plugins';

import { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { withAppDelegateModifications } from './withAppDelegateModifications';
import { withCioAppdelegateXcodeProject } from './withAppDelegateXcodeProject';
import { withCioNotificationsXcodeProject } from './withNotificationsXcodeProject';
import { withCioXcodeProject } from './withXcodeProject';

export function withCIOIos(
  config,
  props: CustomerIOPluginOptionsIOS,
): ConfigPlugin<CustomerIOPluginOptionsIOS> {
  config = withCioNotificationsXcodeProject(config, props);
  config = withAppDelegateModifications(config, props);
  config = withCioXcodeProject(config, props);
  config = withCioAppdelegateXcodeProject(config, props);

  return config;
}
