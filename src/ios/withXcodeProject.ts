import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';

import { injectCIOPodfileCode } from '../helpers/utils/injectCIOPodfileCode';
import { CustomerIOPluginOptionsIOS } from '../types/cio-types';

export const withCioXcodeProject: ConfigPlugin<CustomerIOPluginOptionsIOS> = (
  config,
  cioProps,
) => {
  return withXcodeProject(config, async (props) => {
    const options: CustomerIOPluginOptionsIOS = {
      iosPath: props.modRequest.platformProjectRoot,
      bundleIdentifier: props.ios?.bundleIdentifier,
      devTeam: cioProps?.devTeam,
      bundleVersion: props.ios?.buildNumber,
      bundleShortVersion: props?.version,
      mode: cioProps?.mode,
      iosDeploymentTarget: cioProps?.iosDeploymentTarget,
    };
    const { iosPath } = options;

    await injectCIOPodfileCode(iosPath);

    return props;
  });
};
