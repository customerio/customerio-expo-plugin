import type { ConfigPlugin } from '@expo/config-plugins';
import { withProjectBuildGradle } from '@expo/config-plugins';

import {
  installAndroidCustomLiveNotificationRenderer,
  resolveCustomLiveNotificationRenderer,
} from '../helpers/utils/liveNotificationCustomRenderer';
import type {
  CustomerIOPluginLiveNotificationsOptions,
  LiveNotificationsSDKConfig,
} from '../types/cio-types';

type CustomRendererModParams = {
  /** Build-time options carrying `customRenderer`. */
  liveNotifications: CustomerIOPluginLiveNotificationsOptions | undefined;
  /** SDK config, read only for `customType` — present only on the auto-initialization path. */
  sdkLiveNotifications: LiveNotificationsSDKConfig | undefined;
};

/**
 * Copies the configured custom live notification renderer into the Android source tree.
 *
 * Runs on both initialization paths, like the branding logo and for the same reason: the class is
 * referenced by generated Kotlin on the automatic path and by the `MainApplication` registration on
 * the JavaScript path, and neither compiles unless the file is in the project.
 *
 * Piggybacks on the project build.gradle mod purely for its access to the Android project root,
 * matching how the google-services file and the branding logo are copied.
 */
export const withLiveNotificationCustomRenderer: ConfigPlugin<
  CustomRendererModParams
> = (configOuter, { liveNotifications, sdkLiveNotifications }) => {
  return withProjectBuildGradle(configOuter, (props) => {
    const renderer = resolveCustomLiveNotificationRenderer({
      liveNotifications: sdkLiveNotifications,
      buildOptions: liveNotifications,
      projectRoot: props.modRequest.projectRoot,
    });
    if (renderer) {
      installAndroidCustomLiveNotificationRenderer(
        renderer,
        props.modRequest.platformProjectRoot
      );
    }
    return props;
  });
};
