import type { CustomerIOPluginOptionsIOS } from '../../types/cio-types';
import { logger } from '../../utils/logger';
import { CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME, getRelativePathToRNSDK } from '../constants/ios';
import { injectCodeByRegex } from './codeInjection';
import { FileManagement } from './fileManagement';

export type InjectCIOPodfileOptions = {
  /** When true, add the location subspec. When false/omit, use single push subspec only. */
  locationEnabled?: boolean;
  /** When true, add the geofence subspec (implies location). */
  geofenceEnabled?: boolean;
  /** When false, omit the push provider subspec (location/geofence-only). When true/omit, include it. */
  hasPush?: boolean;
  /** When true, add the `liveactivities` subspec (enables -DCIO_LIVEACTIVITIES_ENABLED). */
  liveNotificationsEnabled?: boolean;
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
  const liveNotificationsEnabled = options?.liveNotificationsEnabled === true;
  const hasPush = options?.hasPush !== false;
  const pushSubspec = isFcmPushProvider ? 'fcm' : 'apn';

  // No optional modules: keep the single push-provider subspec form. hasPush is intentionally
  // not checked here — callers only pass hasPush:false alongside an enabled optional module.
  if (!locationEnabled && !geofenceEnabled && !liveNotificationsEnabled) {
    return `pod 'customerio-reactnative/${pushSubspec}', :path => '${resolvedPath}'`;
  }

  // Otherwise the explicit :subspecs array form, naming whichever modules are enabled.
  // Geofence pulls in Location transitively (and defines CIO_LOCATION_ENABLED), so the
  // 'location' subspec is redundant when geofence is enabled.
  const subspecs = [
    ...(hasPush ? [pushSubspec] : []),
    ...(locationEnabled && !geofenceEnabled ? ['location'] : []),
    ...(geofenceEnabled ? ['geofence'] : []),
    ...(liveNotificationsEnabled ? ['liveactivities'] : []),
  ];
  const subspecList = subspecs.map((s) => `'${s}'`).join(', ');
  return `pod 'customerio-reactnative', :subspecs => [${subspecList}], :path => '${resolvedPath}'`;
}

const HOST_APP_BLOCK_START = '# --- CustomerIO Host App START ---';
const HOST_APP_BLOCK_END = '# --- CustomerIO Host App END ---';
const NOTIFICATION_BLOCK_START = '# --- CustomerIO Notification START ---';
const NOTIFICATION_BLOCK_END = '# --- CustomerIO Notification END ---';
const LIVE_ACTIVITY_BLOCK_START = '# --- CustomerIO Live Activity START ---';
const LIVE_ACTIVITY_BLOCK_END = '# --- CustomerIO Live Activity END ---';

/**
 * Pure string transform: given the existing Podfile contents, returns the
 * Podfile with the CustomerIO host-app block injected before the Expo
 * `post_install do |installer|` anchor. If the plugin already owns a block, it
 * is replaced so provider and optional-module changes are reflected on
 * incremental prebuilds.
 */
export function injectHostAppPodfileCode(
  podfileContent: string,
  iosPath: string,
  isFcmPushProvider: boolean,
  options?: InjectCIOPodfileOptions
): string {
  const podLine = buildHostAppPodSnippet(iosPath, isFcmPushProvider, options);
  const snippetToInjectInPodfile = `
${HOST_APP_BLOCK_START}
  ${podLine}
${HOST_APP_BLOCK_END}
`.trim();

  const replaced = replaceManagedBlock(
    podfileContent,
    HOST_APP_BLOCK_START,
    HOST_APP_BLOCK_END,
    snippetToInjectInPodfile
  );
  if (replaced !== undefined) {
    return replaced;
  }

  // The "post_install" line is always present in an Expo project Podfile, so
  // it is a reliable anchor for the initial insertion.
  const lineInPodfileToInjectSnippetBefore = /post_install do \|installer\|/;

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
 * Podfile with the rich-push NotificationService target block appended at the
 * end. If the plugin already owns a block, it is replaced so provider and
 * linkage changes are reflected on incremental prebuilds.
 */
export function appendNotificationTargetToPodfile(
  podfileContent: string,
  iosPath: string,
  isFcmPushProvider: boolean,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks'],
): string {
  const snippetToAppend = `
${NOTIFICATION_BLOCK_START}
target 'NotificationService' do
  ${useFrameworks === 'static' ? 'use_frameworks! :linkage => :static' : ''}
  pod 'customerio-reactnative-richpush/${isFcmPushProvider ? 'fcm' : 'apn'}', :path => '${getRelativePathToRNSDK(iosPath)}'
end
${NOTIFICATION_BLOCK_END}
`.trim();

  const replaced = replaceManagedBlock(
    podfileContent,
    NOTIFICATION_BLOCK_START,
    NOTIFICATION_BLOCK_END,
    snippetToAppend
  );
  if (replaced !== undefined) {
    return replaced;
  }

  // Real Podfiles end with a trailing newline, so the appended block starts on
  // a fresh line in practice.
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
    await FileManagement.write(filename, next);
  }
}

/**
 * Pods the generated widget extension links directly. A widget target does not inherit the host
 * app's pods, so it has to name them itself.
 *
 * Deliberately unversioned: CocoaPods resolves the whole Podfile at once, so these unify with the
 * version the host app already pulls through `customerio-reactnative`, and cannot drift from it.
 */
const WIDGET_PODS = [
  'CustomerIOLiveActivitiesTemplates',
  'CustomerIOLiveActivitiesAttributes',
];

/**
 * Pure string transform: given the existing Podfile contents, returns the Podfile with the Live
 * Activity widget target block appended at the end. The widget links the Customer.io iOS SDK's Live
 * Activity template + attributes pods (published to CocoaPods on release). If the plugin already
 * owns a block, it is replaced so linkage changes are reflected on incremental prebuilds. Exported
 * for tests.
 */
export function appendLiveActivityWidgetTargetToPodfile(
  podfileContent: string,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks'],
): string {
  const snippetToAppend = `
${LIVE_ACTIVITY_BLOCK_START}
target '${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME}' do
  ${useFrameworks === 'static' ? 'use_frameworks! :linkage => :static' : ''}
${WIDGET_PODS.map((pod) => `  pod '${pod}'`).join('\n')}
end
${LIVE_ACTIVITY_BLOCK_END}
`.trim();

  const replaced = replaceManagedBlock(
    podfileContent,
    LIVE_ACTIVITY_BLOCK_START,
    LIVE_ACTIVITY_BLOCK_END,
    snippetToAppend
  );
  if (replaced !== undefined) {
    return replaced;
  }

  // Separate from any preceding CIO block (the notification block is appended trimmed, without a
  // trailing newline) and leave a trailing newline so a following block starts on its own line.
  const separator = podfileContent.endsWith('\n') ? '' : '\n';
  return `${podfileContent}${separator}${snippetToAppend}\n`;
}

export async function injectCIOLiveActivityWidgetPodfileCode(
  iosPath: string,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks'],
) {
  const filename = `${iosPath}/Podfile`;
  const podfile = await FileManagement.read(filename);
  const next = appendLiveActivityWidgetTargetToPodfile(podfile, useFrameworks);
  if (next !== podfile) {
    await FileManagement.write(filename, next);
  }
}

function replaceManagedBlock(
  contents: string,
  startMarker: string,
  endMarker: string,
  replacement: string
): string | undefined {
  const start = contents.indexOf(startMarker);
  if (start < 0) {
    return undefined;
  }

  const endMarkerStart = contents.indexOf(endMarker, start + startMarker.length);
  if (endMarkerStart < 0) {
    logger.warn(
      `Found ${startMarker} without ${endMarker}; Customer.io left the Podfile unchanged`
    );
    return contents;
  }

  const end = endMarkerStart + endMarker.length;
  return `${contents.slice(0, start)}${replacement}${contents.slice(end)}`;
}
