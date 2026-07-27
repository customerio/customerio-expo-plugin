import type {
  CustomerIOPluginLiveNotificationsOptions,
  NativeSDKConfig,
} from '../../types/cio-types';
import { resolveLiveNotificationTypes } from './patchLiveNotificationCode';

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

  // An explicit but entirely unrecognized `types` list leaves nothing to generate.
  return resolveLiveNotificationTypes(configured.types).length > 0;
}
