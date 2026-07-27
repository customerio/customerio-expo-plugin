import type {
  CustomerIOPluginLiveNotificationsOptions,
  NativeSDKConfig,
} from '../../types/cio-types';
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
 * Android needs nothing at build time; it reads its types and branding from the SDK config.
 */
export function isLiveNotificationsEnabled(
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
