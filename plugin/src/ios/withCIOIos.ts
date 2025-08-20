import type { ExpoConfig } from '@expo/config-types';

import type {
  CustomerIOPluginOptionsIOS,
  CustomerIOPluginPushNotificationOptions,
  NativeSDKConfig,
} from '../types/cio-types';
import { mergeConfigWithEnvValues } from '../utils/config';
import { isExpoVersion53OrHigher } from './utils';
import { withAppDelegateModifications } from './withAppDelegateModifications';
import { withCIOIosSwift } from './withCIOIosSwift';
import { withGoogleServicesJsonFile } from './withGoogleServicesJsonFile';
import { withCioNotificationsXcodeProject } from './withNotificationsXcodeProject';
import { withCioXcodeProject } from './withXcodeProject';

export function withCIOIos(
  config: ExpoConfig,
  sdkConfig: NativeSDKConfig | undefined,
  props: CustomerIOPluginOptionsIOS
) {
  const isSwiftProject = isExpoVersion53OrHigher(config);
  const platformConfig = mergeDeprecatedPropertiesAndLogWarnings(props);
  const richPushConfig = mergeConfigWithEnvValues(platformConfig, sdkConfig);

  if (platformConfig.pushNotification) {
    if (isSwiftProject) {
      config = withCIOIosSwift(config, sdkConfig, platformConfig);
    } else {
      // Auto initialization is only supported in Swift projects (Expo SDK 53+)
      // Legacy Objective-C projects only support push notifications
      config = withAppDelegateModifications(config, platformConfig);
    }

    config = withCioNotificationsXcodeProject(config, { ...platformConfig, richPushConfig });
    config = withCioXcodeProject(config, platformConfig);
    config = withGoogleServicesJsonFile(config, platformConfig);
  }

  return config;
}

/**  The basic purpose of this function is to centralize where we handle the deprecation
  by merging the deprecated properties into the new ios.pushNotification.* properties
  and logging a warning if they are set. This way, we can remove the deprecated properties
  from the top level of the ios object in the future, and update this function
  while the rest of the plugin code remains unchanged.
*/
const mergeDeprecatedPropertiesAndLogWarnings = (
  props: CustomerIOPluginOptionsIOS
) => {
  // The deprecatedTopLevelProperties maps the top level properties
  // that are deprecated to the new ios.pushNotification.* properties
  // that should be used instead. The deprecated properties are
  // still available for backwards compatibility, but they will
  // be removed in the future.

  const deprecatedTopLevelProperties = {
    showPushAppInForeground: props.showPushAppInForeground,
    autoTrackPushEvents: props.autoTrackPushEvents,
    handleDeeplinkInKilledState: props.handleDeeplinkInKilledState,
    disableNotificationRegistration: props.disableNotificationRegistration,
    autoFetchDeviceToken: props.autoFetchDeviceToken,
  };

  // loop over all the deprecated properties and log a warning if they are set
  Object.entries(deprecatedTopLevelProperties).forEach(([key, value]) => {
    if (value !== undefined) {
      console.warn(
        `The ios.${key} property is deprecated. Please use ios.pushNotification.${key} instead.`
      );

      if (props.pushNotification === undefined) {
        props.pushNotification = {} as CustomerIOPluginPushNotificationOptions;
      }
      const propKey = key as keyof CustomerIOPluginPushNotificationOptions;
      if (props.pushNotification[propKey] === undefined) {
        props.pushNotification = {
          ...props.pushNotification,
          [propKey]: value,
        };
      } else {
        console.warn(
          `The ios.${key} property is deprecated. Since the value of ios.pushNotification.${key} is set, it will be used.`
        );
      }
    }
  });

  return props;
};
