import type { ExpoConfig } from '@expo/config-types';

import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { withAppDelegateModifications } from './withAppDelegateModifications';
import { withCioNotificationsXcodeProject } from './withNotificationsXcodeProject';
import { withCioXcodeProject } from './withXcodeProject';
import { withGoogleServicesJsonFile } from './withGoogleServicesJsonFile';

export function withCIOIos(
  config: ExpoConfig,
  props: CustomerIOPluginOptionsIOS
) {
  if (props.pushNotification) {
    config = withAppDelegateModifications(config, props);
    config = withCioNotificationsXcodeProject(config, props);
    config = withCioXcodeProject(config, props);
    config = withGoogleServicesJsonFile(config, props);
  }

  return config;
}
