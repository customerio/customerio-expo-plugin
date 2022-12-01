import type { ExpoConfig } from '@expo/config-types';

import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { withAppDelegateModifications } from './withAppDelegateModifications';
import { withCioAppdelegateXcodeProject } from './withAppDelegateXcodeProject';
import { withCioNotificationsXcodeProject } from './withNotificationsXcodeProject';

export function withCIOIos(
  config: ExpoConfig,
  props: CustomerIOPluginOptionsIOS
) {
  if (props.pushNotification?.useRichPush) {
    config = withCioNotificationsXcodeProject(config, props);
  }

  if (props.pushNotification) {
    config = withAppDelegateModifications(config, props);
    config = withCioAppdelegateXcodeProject(config, props);
  }

  return config;
}
