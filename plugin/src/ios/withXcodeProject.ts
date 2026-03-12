import type { ConfigPlugin } from '@expo/config-plugins';
import { withXcodeProject } from '@expo/config-plugins';

import {
  injectCIOPodfileCode,
  type InjectCIOPodfileOptions,
} from '../helpers/utils/injectCIOPodfileCode';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { isFcmPushProvider } from './utils';

export type WithCioXcodeProjectOptions = {
  /** Options for Podfile host app snippet (location subspec, etc.) */
  podfileOptions?: InjectCIOPodfileOptions;
};

/** Props for the CIO Xcode project mod; push options are optional when only location is enabled. */
export type WithCioXcodeProjectProps = Partial<CustomerIOPluginOptionsIOS> &
  WithCioXcodeProjectOptions;

export const withCioXcodeProject: ConfigPlugin<WithCioXcodeProjectProps> = (
  config,
  cioProps
) => {
  return withXcodeProject(config, async (props) => {
    const iosPath = props.modRequest.platformProjectRoot;
    const podfileOptions = cioProps?.podfileOptions;

    await injectCIOPodfileCode(
      iosPath,
      isFcmPushProvider(cioProps as CustomerIOPluginOptionsIOS | undefined),
      podfileOptions
    );

    return props;
  });
};
