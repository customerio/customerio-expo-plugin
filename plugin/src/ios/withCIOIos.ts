import type { ExpoConfig } from '@expo/config-types';

import type {
  CustomerIOPluginOptionsIOS,
  CustomerIOPluginPushNotificationOptions,
} from '../types/cio-types';
import { withAppDelegateModifications } from './withAppDelegateModifications';
import { withGoogleServicesJsonFile } from './withGoogleServicesJsonFile';
import { withCioNotificationsXcodeProject } from './withNotificationsXcodeProject';
import { withCioXcodeProject } from './withXcodeProject';

export function withCIOIos(
  config: ExpoConfig,
  props: CustomerIOPluginOptionsIOS
) {
  const cioProps = mergeDeprecatedPropertiesAndLogWarnings(props);
  if (cioProps.pushNotification) {
    config = withAppDelegateModifications(config, cioProps);
    config = withCioNotificationsXcodeProject(config, cioProps);
    config = withCioXcodeProject(config, cioProps);
    config = withGoogleServicesJsonFile(config, cioProps);
  }

  return config;
}

const mergeDeprecatedPropertiesAndLogWarnings = (
  props: CustomerIOPluginOptionsIOS
) => {
  const deprecatedTopLevelProperties = {
    showPushAppInForeground: props.showPushAppInForeground,
    autoTrackPushEvents: props.autoTrackPushEvents,
    handleDeeplinkInKilledState: props.handleDeeplinkInKilledState,
    disableNotificationRegistration: props.disableNotificationRegistration,
  };

  // loop over all the deprecated properties and log a warning if they are set
  Object.entries(deprecatedTopLevelProperties).forEach(([key, value]) => {
    if (value !== undefined) {
      console.warn(
        `The ios.${key} property is deprecated. Use ios.pushNotification.${key} instead.`
      );

      if (props.pushNotification === undefined) {
        props.pushNotification = {};
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

  if (props.pushNotification?.env !== undefined) {
    console.warn(
      'The ios.pushNotification.env property is deprecated. Use ios.nv instead.'
    );
    if (props.env === undefined) {
      props.env = props.pushNotification
        ?.env as unknown as CustomerIOPluginOptionsIOS['env'];
    }
    if (
      props.pushNotification?.env.cdpApiKey !== undefined &&
      props.env.cdpApiKey === undefined
    ) {
      props.env.cdpApiKey = props.pushNotification.env.cdpApiKey;
    }

    if (
      props.pushNotification?.env.region !== undefined &&
      props.env.region === undefined
    ) {
      props.env.region = props.pushNotification.env.region;
    }
  }

  return props;
};
