import type { ExpoConfig } from '@expo/config-types';

import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { withAppDelegateModifications } from './withAppDelegateModifications';
import { withCioAppdelegateXcodeProject } from './withAppDelegateXcodeProject';
import { withCioNotificationsXcodeProject } from './withNotificationsXcodeProject';
import { withCioXcodeProject } from './withXcodeProject';

export function withCIOIos(
  config: ExpoConfig,
  props: CustomerIOPluginOptionsIOS
) {
  if (props.useRichPush) {
    config = withCioNotificationsXcodeProject(config, props);
  }

  if (props.enablePushNotification) {
    config = withAppDelegateModifications(config, props);
    config = withCioAppdelegateXcodeProject(config, props);
  }

  config = withCioXcodeProject(config, props);

  return config;
}
