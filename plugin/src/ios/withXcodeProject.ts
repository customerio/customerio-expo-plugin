import type { ConfigPlugin } from '@expo/config-plugins';
import { withXcodeProject } from '@expo/config-plugins';

import { injectCIOPodfileCode } from '../helpers/utils/injectCIOPodfileCode';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { isFcmPushProvider } from './utils';

export const withCioXcodeProject: ConfigPlugin<CustomerIOPluginOptionsIOS> = (
  config,
  cioProps
) => {
  return withXcodeProject(config, async (props) => {
    const iosPath = props.modRequest.platformProjectRoot;

    await injectCIOPodfileCode(iosPath, isFcmPushProvider(cioProps));

    return props;
  });
};
