import type { ConfigPlugin } from '@expo/config-plugins';
import { withAppDelegate } from '@expo/config-plugins';

import { logger } from '../utils/logger';

// Per-step idempotency markers. The two injections are guarded independently: the import marker
// is added by addGeofenceImport and the bootstrap marker by injectGeofenceBootstrap. Keying both
// steps off a single symbol would let a partial application (import added, bootstrap injection
// failed) look "done" on the next prebuild, permanently skipping the missing bootstrap.
const GEOFENCE_IMPORT_MARKER = 'import CioLocationGeofence';
const GEOFENCE_BOOTSTRAP_MARKER = 'GeofenceModule.bootstrapForBackgroundDelivery';

const GEOFENCE_IMPORT_SNIPPET = `#if canImport(CioLocationGeofence)
import CioLocationGeofence
#endif`;

const GEOFENCE_BOOTSTRAP_SNIPPET = `    #if canImport(CioLocationGeofence)
    // iOS can cold-launch the app for a geofence transition without the JS runtime, so bootstrap
    // background delivery here rather than relying on CustomerIO.initialize. Safe alongside normal init.
    GeofenceModule.bootstrapForBackgroundDelivery(launchOptions: launchOptions)
    #endif
`;

/**
 * Adds the geofence module import after the last top-level import statement.
 * The import is compiled out via `#if canImport` when the geofence subspec is absent.
 */
const addGeofenceImport = (contents: string): string => {
  if (contents.includes(GEOFENCE_IMPORT_MARKER)) {
    return contents;
  }

  const importRegex = /^(?:@_exported\s+)?(?:internal\s+)?import\s+.+$/gm;
  let lastMatchEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(contents)) !== null) {
    lastMatchEnd = match.index + match[0].length;
  }

  if (lastMatchEnd < 0) {
    logger.warn('Could not find an import statement in AppDelegate.swift; skipping geofence import');
    return contents;
  }

  return (
    contents.substring(0, lastMatchEnd) +
    `\n\n${GEOFENCE_IMPORT_SNIPPET}` +
    contents.substring(lastMatchEnd)
  );
};

/**
 * Injects the geofence background-delivery bootstrap at the top of didFinishLaunchingWithOptions,
 * before React Native is started (the Expo template calls `factory.startReactNative(...)` later in
 * this method). Cold-wake delivery must not depend on the JS runtime, so it has to run first —
 * matching the SDK's reference AppDelegate integration.
 */
const injectGeofenceBootstrap = (contents: string): string => {
  if (contents.includes(GEOFENCE_BOOTSTRAP_MARKER)) {
    return contents;
  }

  const methodRegex =
    /(func\s+application\s*\(\s*_\s+application\s*:\s*UIApplication\s*,\s*didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{)/;
  const match = contents.match(methodRegex);

  if (!match) {
    logger.warn(
      'Could not find didFinishLaunchingWithOptions in AppDelegate.swift; skipping geofence bootstrap'
    );
    return contents;
  }

  const insertPosition = (match.index ?? 0) + match[0].length;
  return (
    contents.substring(0, insertPosition) +
    `\n${GEOFENCE_BOOTSTRAP_SNIPPET}` +
    contents.substring(insertPosition)
  );
};

/**
 * Pure string transform: adds the geofence import and background-delivery bootstrap
 * to the Swift AppDelegate. Each step is independently idempotent, so a re-run after a
 * partial application injects only the missing piece.
 *
 * Exported for tests.
 */
export function modifyAppDelegateForGeofenceBootstrap(contents: string): string {
  return injectGeofenceBootstrap(addGeofenceImport(contents));
}

/**
 * Injects the geofence background-delivery bootstrap into the Swift AppDelegate.
 * Runs whenever geofence is enabled, independent of push/auto-init, so cold-wake
 * background geofence transitions are delivered even when the JS runtime isn't running.
 */
export const withGeofenceAppDelegate: ConfigPlugin = (config) => {
  return withAppDelegate(config, (appDelegateConfig) => {
    appDelegateConfig.modResults.contents = modifyAppDelegateForGeofenceBootstrap(
      appDelegateConfig.modResults.contents
    );
    return appDelegateConfig;
  });
};
