import type { ExpoConfig } from '@expo/config-types';
import { withEntitlementsPlist } from '@expo/config-plugins';
import type {
  CustomerIOPluginOptionsIOS,
  CustomerIOPluginPushNotificationOptions,
  CustomerIOPluginLiveNotificationsOptions,
  CustomerIOPluginLocationOptions,
  NativeSDKConfig,
} from '../types/cio-types';
import { isLiveNotificationsEnabled } from '../helpers/utils/liveNotificationsEnabled';
import { mergeConfigWithEnvValues } from '../utils/config';
import { logger } from '../utils/logger';
import { validatePushNotificationOptions } from '../utils/validation';
import { isExpoVersion53OrHigher } from './utils';
import { withAppDelegateModifications } from './withAppDelegateModifications';
import { withCIOIosSwift } from './withCIOIosSwift';
import { withCioLiveActivityWidgetXcodeProject } from './withCioLiveActivityWidgetXcodeProject';
import { withGoogleServicesJsonFile } from './withGoogleServicesJsonFile';
import { withLiveActivityInfoPlist } from './withLiveActivityInfoPlist';
import { withCioNotificationsXcodeProject } from './withNotificationsXcodeProject';
import { withCioXcodeProject } from './withXcodeProject';

export function withCIOIos(
  config: ExpoConfig,
  sdkConfig?: NativeSDKConfig,
  props?: CustomerIOPluginOptionsIOS,
  location?: CustomerIOPluginLocationOptions,
  liveNotifications?: CustomerIOPluginLiveNotificationsOptions,
) {
  const isSwiftProject = isExpoVersion53OrHigher(config);
  const platformConfig = mergeDeprecatedPropertiesAndLogWarnings(props);
  const locationEnabled = location?.enabled === true;
  const liveNotificationsEnabled = isLiveNotificationsEnabled(
    liveNotifications,
    sdkConfig
  );

  if (platformConfig?.pushNotification) {
    validatePushNotificationOptions(platformConfig.pushNotification);
    if (isSwiftProject) {
      config = withCIOIosSwift(config, sdkConfig, platformConfig, location, liveNotificationsEnabled);
    } else {
      // Auto initialization is only supported in Swift projects (Expo SDK 53+)
      // Legacy Objective-C projects only support push notifications
      config = withAppDelegateModifications(config, platformConfig);
    }

    platformConfig.pushNotification.env = platformConfig.pushNotification.env
      || mergeConfigWithEnvValues(platformConfig, sdkConfig);
    config = withCioNotificationsXcodeProject(config, platformConfig);
    config = withCioXcodeProject(config, {
      ...platformConfig,
      podfileOptions: {
        locationEnabled,
        hasPush: true,
        liveNotificationsEnabled,
      },
    });
    config = withGoogleServicesJsonFile(config, platformConfig);

    // Merge App Group entitlements on host only when appGroupId is explicitly set
    const appGroupId = platformConfig.pushNotification?.appGroupId;
    if (appGroupId) {
      config = withEntitlementsPlist(config, (entitlementsConfig) => {
        const entitlements = entitlementsConfig.modResults as Record<string, unknown>;
        const existing = (entitlements['com.apple.security.application-groups'] as string[] | undefined) ?? [];
        if (!existing.includes(appGroupId)) {
          entitlements['com.apple.security.application-groups'] = [...existing, appGroupId];
        }
        return entitlementsConfig;
      });
    }
  } else if (sdkConfig && isSwiftProject) {
    config = withCIOIosSwift(config, sdkConfig, platformConfig, location, liveNotificationsEnabled);
    if (locationEnabled || liveNotificationsEnabled) {
      config = withCioXcodeProject(config, {
        ...platformConfig,
        podfileOptions: { locationEnabled, hasPush: false, liveNotificationsEnabled },
      });
    }
  } else if (locationEnabled || liveNotificationsEnabled) {
    // No push, no config. Still add the Podfile subspecs so the relevant native modules
    // (location / live activities) are compiled in.
    config = withCioXcodeProject(config, {
      ...platformConfig,
      podfileOptions: { locationEnabled, hasPush: false, liveNotificationsEnabled },
    });
  }

  // Live Activities: set the host Info.plist flag and inject the widget extension target,
  // independent of push. Requires iOS 16.2+.
  if (liveNotificationsEnabled && platformConfig) {
    config = withLiveActivityInfoPlist(config);
    config = withCioLiveActivityWidgetXcodeProject(config, {
      props: platformConfig,
      liveNotifications: sdkConfig?.liveNotifications,
      // `customWidget` lives in the build-time options rather than SDK config, so it reaches the
      // widget whether the app initializes automatically or from JavaScript.
      buildOptions: liveNotifications,
    });
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
  props?: CustomerIOPluginOptionsIOS,
): CustomerIOPluginOptionsIOS | undefined => {
  // The deprecatedTopLevelProperties maps the top level properties
  // that are deprecated to the new ios.pushNotification.* properties
  // that should be used instead. The deprecated properties are
  // still available for backwards compatibility, but they will
  // be removed in the future.

  if (!props) {
    return props
  }

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
      logger.warn(
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
        logger.warn(
          `The ios.${key} property is deprecated. Since the value of ios.pushNotification.${key} is set, it will be used.`
        );
      }
    }
  });

  return props;
};
