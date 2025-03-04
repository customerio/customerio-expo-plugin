import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';

import { injectCIOPodfileCode } from '../helpers/utils/injectCIOPodfileCode';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { isFcmPushProvider } from './utils';

export const withCioXcodeProject: ConfigPlugin<CustomerIOPluginOptionsIOS> = (
  config,
  cioProps
) => {
  return withXcodeProject(config, async (props) => {
    const options: CustomerIOPluginOptionsIOS = {
      iosPath: props.modRequest.platformProjectRoot,
      bundleIdentifier: props.ios?.bundleIdentifier,
      devTeam: cioProps?.devTeam,
      bundleVersion: props.ios?.buildNumber,
      bundleShortVersion: props?.version,
      iosDeploymentTarget: cioProps?.iosDeploymentTarget,
    };
    const { iosPath } = options;

    await injectCIOPodfileCode(iosPath, isFcmPushProvider(cioProps));

    return props;
  });
};
