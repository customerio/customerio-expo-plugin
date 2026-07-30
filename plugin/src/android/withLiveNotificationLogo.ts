import type { ConfigPlugin } from '@expo/config-plugins';
import { withProjectBuildGradle } from '@expo/config-plugins';

import { installAndroidLiveNotificationLogo } from '../helpers/utils/liveNotificationLogo';
import type { LiveNotificationBranding } from '../types/cio-types';

/**
 * Copies the configured Live Notifications branding logo into the Android drawables.
 *
 * The drawable is resolved by name at runtime, so it has to exist for the logo to render — whether
 * the name comes from the generated initializer or from the branding an app passes to
 * `CustomerIO.initialize` in JavaScript. That is why this runs off the build-time branding options
 * rather than the SDK config, which exists only on the automatic-initialization path.
 *
 * Piggybacks on the project build.gradle mod purely for its access to the Android project root,
 * matching how the google-services file is copied.
 */
export const withLiveNotificationLogo: ConfigPlugin<
  LiveNotificationBranding | undefined
> = (configOuter, branding) => {
  return withProjectBuildGradle(configOuter, (props) => {
    installAndroidLiveNotificationLogo(
      branding,
      props.modRequest.platformProjectRoot,
      props.modRequest.projectRoot
    );
    return props;
  });
};
