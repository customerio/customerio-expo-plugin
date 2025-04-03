import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';

import { isFcmPushProvider } from './utils';
import { injectCIOPodfileCode } from '../helpers/utils/injectCIOPodfileCode';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';

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
