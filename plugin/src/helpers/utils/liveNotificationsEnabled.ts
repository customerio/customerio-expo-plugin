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
 * `enabled: false` is an explicit kill switch and wins over both paths, so an app that has
 * `config.liveNotifications` can still turn the build-time setup off without deleting its type list.
 * Only an explicit `false` does this — omitting the flag under auto initialization means "infer it",
 * which is the common case.
 *
 * Android needs no target of its own at build time — it reads its types from the SDK config and its
 * branding from the build-time options, and the only file the plugin writes for it is the branding
 * logo drawable.
 *
 * Push is not required here. It is what most setups use — Android reaches the feature through
 * `ModuleMessagingPushFCM`, and iOS registers push-to-start against the device token push supplies —
 * but an app can also obtain a token through another provider and pass it to Customer.io for
 * backend-driven activities. The tap-URL wiring is installed on both paths (see `withCIOIosSwift`)
 * so neither loses attribution.
 */
export function isLiveNotificationsEnabled(
  liveNotifications: CustomerIOPluginLiveNotificationsOptions | undefined,
  sdkConfig: NativeSDKConfig | undefined
): boolean {
  if (liveNotifications?.enabled !== undefined) {
    return liveNotifications.enabled;
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

/**
 * The SDK config the generated initializers should be built from, with `liveNotifications` dropped
 * when the feature is off.
 *
 * Two different inputs decide what gets generated: `isLiveNotificationsEnabled` gates the build-time
 * artifacts (iOS widget target, `NSSupportsLiveActivities`, the `liveactivities` pod subspec), while
 * the native registration in the generated initializer comes straight from `config.liveNotifications`.
 * They have to agree. An explicit `enabled: false` turns the artifacts off, and leaving the
 * registration in place would emit `import CioLiveActivities` and a `LiveActivitiesModule` against a
 * pod that is no longer linked — an iOS compile failure — while Android would go on registering the
 * types at runtime, so the opt-out wouldn't opt out of anything.
 *
 * Returns the config unchanged whenever the feature is on, or when there is nothing to strip.
 */
export function resolveSdkConfigForLiveNotifications(
  liveNotifications: CustomerIOPluginLiveNotificationsOptions | undefined,
  sdkConfig: NativeSDKConfig | undefined
): NativeSDKConfig | undefined {
  if (!sdkConfig?.liveNotifications) {
    return sdkConfig;
  }
  if (isLiveNotificationsEnabled(liveNotifications, sdkConfig)) {
    return sdkConfig;
  }
  return { ...sdkConfig, liveNotifications: undefined };
}
