import type {
  CustomerIOPluginLiveNotificationsOptions,
  NativeSDKConfig,
} from '../../types/cio-types';
import { logger } from '../../utils/logger';
import {
  resolveCustomLiveNotificationType,
  resolveLiveNotificationTypes,
} from './patchLiveNotificationCode';

/**
 * Whether to generate the iOS build-time setup for Live Notifications: the widget extension
 * target, the `NSSupportsLiveActivities` Info.plist key, and the Podfile subspec.
 *
 * Two ways to turn it on, matching the two initialization paths:
 * - **Auto initialization** — `config.liveNotifications` is present. The types it lists are
 *   registered natively, so requiring a second `enabled` flag would only be a way to get the
 *   two out of sync.
 * - **JavaScript initialization** — there is no `config`, so the app sets
 *   `liveNotifications.enabled` to get the native artifacts while registering its types at
 *   runtime.
 *
 * Android needs no target of its own at build time — it reads its types from the SDK config and its
 * branding from the build-time options, and the only file the plugin writes for it is the branding
 * logo drawable.
 *
 * **Push is a precondition.** Live Notifications cannot work without it: on Android the feature
 * lives inside the push module and is reached through `ModuleMessagingPushFCM`, and on iOS the
 * Live Activities module registers push-to-start against the device token push supplies. An app that
 * asks for Live Notifications without configuring `ios.pushNotification` is warned and gets none of
 * the build-time setup — generating a widget extension that can never receive an activity, and whose
 * taps are never routed, is worse than generating nothing.
 */
export function isLiveNotificationsEnabled(
  liveNotifications: CustomerIOPluginLiveNotificationsOptions | undefined,
  sdkConfig: NativeSDKConfig | undefined,
  hasPushNotification: boolean
): boolean {
  if (!requested(liveNotifications, sdkConfig)) {
    return false;
  }

  if (!hasPushNotification) {
    logger.warn(
      '[customerio-expo-plugin] Live Notifications need push notifications, so no Live Notification ' +
        'setup was generated. Configure ios.pushNotification alongside them: Android hosts the ' +
        'feature in its push module, and iOS registers push-to-start against the device token push ' +
        'provides.'
    );
    return false;
  }

  return true;
}

/** Whether the app asked for Live Notifications at all, ignoring whether they can work. */
function requested(
  liveNotifications: CustomerIOPluginLiveNotificationsOptions | undefined,
  sdkConfig: NativeSDKConfig | undefined
): boolean {
  if (liveNotifications?.enabled === true) {
    return true;
  }

  const configured = sdkConfig?.liveNotifications;
  if (!configured) {
    return false;
  }

  if (resolveLiveNotificationTypes(configured.types).length > 0) {
    return true;
  }

  // A custom type on its own is enough: the widget extension renders the app's own SwiftUI, and the
  // app still needs the Info.plist key and the Podfile subspec for it. Turning it on here is also
  // what surfaces a `customType` configured without a `customWidget` to render it, rather than
  // silently producing nothing.
  //
  // `customWidget` alone does not appear here: it is a build-time option that a
  // JavaScript-initialized app pairs with `enabled`, already handled above.
  return resolveCustomLiveNotificationType(configured.customType) !== undefined;
}
