import type { ExpoConfig } from '@expo/config-types';

import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { withCioNotificationsXcodeProject } from './withNotificationsXcodeProject';
import { withCioXcodeProject } from './withXcodeProject';

export function withCIOIos(
  config: ExpoConfig,
  props: CustomerIOPluginOptionsIOS
) {
  if (props.pushNotification) {
    config = withCioNotificationsXcodeProject(config, props);
    config = withCioXcodeProject(config, props);
  }

  return config;
}
