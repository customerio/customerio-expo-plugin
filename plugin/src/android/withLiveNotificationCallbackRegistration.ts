import type { ConfigPlugin } from '@expo/config-plugins';
import { withMainApplication } from '@expo/config-plugins';

import { CIO_MAINAPPLICATION_ONCREATE_REGEX } from '../helpers/constants/android';
import { resolveCustomLiveNotificationRenderer } from '../helpers/utils/liveNotificationCustomRenderer';
import type { CustomerIOPluginLiveNotificationsOptions } from '../types/cio-types';
import { addCodeToMethod, addImportToFile } from '../utils/android';

const WRAPPER_CLASS = 'NativeLiveActivitiesModule';
const WRAPPER_IMPORT = `import io.customer.reactnative.sdk.liveactivities.${WRAPPER_CLASS}`;

/**
 * Registers the app's custom render callback from `MainApplication.onCreate`, for apps that
 * initialize the SDK from JavaScript.
 *
 * The automatic-initialization path does not need this: its generated initializer sets the callback
 * on the push module config directly (see `patchLiveNotificationCode`). A JavaScript-initialized app
 * has no such initializer — the SDK is built later, from JavaScript, through the React Native
 * wrapper — and the wrapper applies whatever static callback was registered before that happens.
 * `onCreate` is the only place guaranteed to run first, and it runs in every process, including one
 * Android starts solely to deliver a push.
 */
export const withLiveNotificationCallbackRegistration: ConfigPlugin<
  CustomerIOPluginLiveNotificationsOptions | undefined
> = (configOuter, liveNotifications) => {
  return withMainApplication(configOuter, async (config) => {
    // Silent: withLiveNotificationCustomRenderer runs the same resolution and owns the warnings.
    // `customType` is not visible on this path — it reaches the SDK from JavaScript — so pass none
    // and let a configured renderer stand on its own.
    const renderer = resolveCustomLiveNotificationRenderer({
      liveNotifications: undefined,
      buildOptions: liveNotifications,
      projectRoot: config.modRequest.projectRoot,
      silent: true,
    });
    if (!renderer) return config;

    const registration = `${WRAPPER_CLASS}.setLiveNotificationCallback(${renderer.className}())`;
    let contents = config.modResults.contents;
    if (!contents.includes(registration)) {
      contents = addCodeToMethod(
        contents,
        CIO_MAINAPPLICATION_ONCREATE_REGEX,
        registration
      );
    }
    contents = addImportToFile(contents, WRAPPER_IMPORT);
    contents = addImportToFile(
      contents,
      `import ${renderer.classPackage}.${renderer.className}`
    );

    config.modResults.contents = contents;
    return config;
  });
};
