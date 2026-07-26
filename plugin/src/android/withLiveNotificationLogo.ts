import type { ConfigPlugin } from '@expo/config-plugins';
import { withProjectBuildGradle } from '@expo/config-plugins';

import { installAndroidLiveNotificationLogo } from '../helpers/utils/liveNotificationLogo';
import type { NativeSDKConfig } from '../types/cio-types';

/**
 * Copies the configured Live Notifications branding logo into the Android drawables.
 *
 * The generated initializer resolves it by name at runtime, so the drawable has to exist for the
 * logo to render. Piggybacks on the project build.gradle mod purely for its access to the Android
 * project root, matching how the google-services file is copied.
 */
export const withLiveNotificationLogo: ConfigPlugin<NativeSDKConfig> = (
  configOuter,
  sdkConfig
) => {
  return withProjectBuildGradle(configOuter, (props) => {
    installAndroidLiveNotificationLogo(
      sdkConfig.liveNotifications?.branding,
      props.modRequest.platformProjectRoot,
      props.modRequest.projectRoot
    );
    return props;
  });
};
