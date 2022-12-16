import type { ExpoConfig } from '@expo/config-types';

import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { withAppDelegateModifications } from './withAppDelegateModifications';
import { withCioNotificationsXcodeProject } from './withNotificationsXcodeProject';

export function withCIOIos(
  config: ExpoConfig,
  props: CustomerIOPluginOptionsIOS
) {
  if (props.pushNotification) {
    config = withAppDelegateModifications(config, props);
    config = withCioNotificationsXcodeProject(config, props);
  }

  return config;
}
