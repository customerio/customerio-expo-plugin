import type { CustomerIOPluginOptionsIOS } from '../../types/cio-types';
import { logger } from '../../utils/logger';
import { getRelativePathToRNSDK } from '../constants/ios';
import { injectCodeByRegex } from './codeInjection';
import { FileManagement } from './fileManagement';

export type InjectCIOPodfileOptions = {
  /** When true, add the location subspec. When false/omit, use single push subspec only. */
  locationEnabled?: boolean;
  /** When true, add the geofence subspec (implies location). */
  geofenceEnabled?: boolean;
  /** When false, omit the push provider subspec (location/geofence-only). When true/omit, include it. */
  hasPush?: boolean;
};

/** Builds the host-app pod snippet for the Podfile.
 *
 * The :path is resolved at prebuild time by `getRelativePathToRNSDK`,
 * which dispatches on the installed React Native version so the path
 * matches what RN pod autolinking will emit (lexical for RN <0.80,
 * realpath for RN >=0.80). Baking the resolved string directly avoids
 * any Ruby/install-time logic in the Podfile and keeps the snippet
 * trivially diff-able.
 *
 * Exported for tests.
 */
export function buildHostAppPodSnippet(
  iosPath: string,
  isFcmPushProvider: boolean,
  options?: InjectCIOPodfileOptions
): string {
  const resolvedPath = getRelativePathToRNSDK(iosPath);
  const locationEnabled = options?.locationEnabled === true;
  const geofenceEnabled = options?.geofenceEnabled === true;
  const hasPush = options?.hasPush !== false;
  const pushSubspec = isFcmPushProvider ? 'fcm' : 'apn';

  // No optional modules: keep the single push-provider subspec form. hasPush is intentionally
  // not checked here — callers only pass hasPush:false alongside an enabled location/geofence module.
  if (!locationEnabled && !geofenceEnabled) {
    return `pod 'customerio-reactnative/${pushSubspec}', :path => '${resolvedPath}'`;
  }

  // Geofence pulls in Location transitively (and defines CIO_LOCATION_ENABLED), so the
  // 'location' subspec is redundant when geofence is enabled.
  const subspecs = [
    ...(hasPush ? [pushSubspec] : []),
    ...(locationEnabled && !geofenceEnabled ? ['location'] : []),
    ...(geofenceEnabled ? ['geofence'] : []),
  ];
  const subspecList = subspecs.map((s) => `'${s}'`).join(', ');
  return `pod 'customerio-reactnative', :subspecs => [${subspecList}], :path => '${resolvedPath}'`;
}

const HOST_APP_BLOCK_START = '# --- CustomerIO Host App START ---';
const HOST_APP_BLOCK_END = '# --- CustomerIO Host App END ---';
const NOTIFICATION_BLOCK_START = '# --- CustomerIO Notification START ---';
const NOTIFICATION_BLOCK_END = '# --- CustomerIO Notification END ---';

/**
 * Pure string transform: given the existing Podfile contents, returns the
 * Podfile with the CustomerIO host-app block injected before the Expo
 * `post_install do |installer|` anchor. Idempotent — returns input unchanged
 * if the block is already present.
 */
export function injectHostAppPodfileCode(
  podfileContent: string,
  iosPath: string,
  isFcmPushProvider: boolean,
  options?: InjectCIOPodfileOptions
): string {
  if (podfileContent.match(new RegExp(HOST_APP_BLOCK_START))) {
    return podfileContent;
  }

  // We need to decide what line of code in the Podfile to insert our native code.
  // The "post_install" line is always present in an Expo project Podfile so it's reliable.
  // Find that line in the Podfile and then we will insert our code above that line.
  const lineInPodfileToInjectSnippetBefore = /post_install do \|installer\|/;
  const podLine = buildHostAppPodSnippet(iosPath, isFcmPushProvider, options);

  const snippetToInjectInPodfile = `
${HOST_APP_BLOCK_START}
  ${podLine}
${HOST_APP_BLOCK_END}
`.trim();

  return injectCodeByRegex(
    podfileContent,
    lineInPodfileToInjectSnippetBefore,
    snippetToInjectInPodfile,
  ).join('\n');
}

export async function injectCIOPodfileCode(
  iosPath: string,
  isFcmPushProvider: boolean,
  options?: InjectCIOPodfileOptions
) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const next = injectHostAppPodfileCode(podfile, iosPath, isFcmPushProvider, options);
  if (next !== podfile) {
    // Await: the next iOS mod (withCioNotificationsXcodeProject) reads this
    // same Podfile. Returning before the write flushes lets the next read
    // race against the in-flight truncate, which (via FileManagement.read's
    // empty-data fallback) rejects with null and aborts the NSE pipeline.
    await FileManagement.write(filename, next);
  } else {
    logger.info('CustomerIO Podfile snippets already exists. Skipping...');
  }
}

/**
 * Pure string transform: given the existing Podfile contents, returns the
 * Podfile with the rich-push NotificationService target block appended at
 * the end. Idempotent — returns input unchanged if the block is already
 * present.
 */
export function appendNotificationTargetToPodfile(
  podfileContent: string,
  iosPath: string,
  isFcmPushProvider: boolean,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks'],
): string {
  if (podfileContent.match(new RegExp(NOTIFICATION_BLOCK_START))) {
    return podfileContent;
  }

  const snippetToAppend = `
${NOTIFICATION_BLOCK_START}
target 'NotificationService' do
  ${useFrameworks === 'static' ? 'use_frameworks! :linkage => :static' : ''}
  pod 'customerio-reactnative-richpush/${isFcmPushProvider ? 'fcm' : 'apn'}', :path => '${getRelativePathToRNSDK(iosPath)}'
end
${NOTIFICATION_BLOCK_END}
`.trim();

  // Mirror FileManagement.append: append directly with no separator (real
  // Podfiles end with a trailing newline, so the appended block starts on a
  // fresh line in practice).
  return `${podfileContent}${snippetToAppend}`;
}

export async function injectCIONotificationPodfileCode(
  iosPath: string,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks'],
  isFcmPushProvider: boolean
) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const next = appendNotificationTargetToPodfile(
    podfile,
    iosPath,
    isFcmPushProvider,
    useFrameworks,
  );
  if (next !== podfile) {
    // FileManagement.append matches what the previous direct-append did.
    // Slice off the leading content (already on disk) and append only the new tail.
    await FileManagement.append(filename, next.slice(podfile.length));
  }
}
