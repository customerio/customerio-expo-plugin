import type { CustomerIOPluginOptionsIOS } from '../../types/cio-types';
import { logger } from '../../utils/logger';
import { CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME, getRelativePathToRNSDK } from '../constants/ios';
import { injectCodeByRegex } from './codeInjection';
import { FileManagement } from './fileManagement';

export type InjectCIOPodfileOptions = {
  /** When true, add the location subspec. When false/omit, use single push subspec only. */
  locationEnabled?: boolean;
  /** When false and locationEnabled, inject only :subspecs => ['location']. When true, use push + location. */
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
  const liveNotificationsEnabled = options?.liveNotificationsEnabled === true;
  const hasPush = options?.hasPush !== false;
  const pushSubspec = isFcmPushProvider ? 'fcm' : 'apn';

  // Simple single-subspec form only when no optional modules are enabled.
  if (!locationEnabled && !liveNotificationsEnabled) {
    return `pod 'customerio-reactnative/${pushSubspec}', :path => '${resolvedPath}'`;
  }

  // Otherwise use the explicit :subspecs array form, including whichever modules are enabled.
  const subspecs: string[] = [];
  if (hasPush) {
    subspecs.push(pushSubspec);
  }
  if (locationEnabled) {
    subspecs.push('location');
  }
  if (liveNotificationsEnabled) {
    subspecs.push('liveactivities');
  }
  const subspecList = subspecs.map((subspec) => `'${subspec}'`).join(', ');
  return `pod 'customerio-reactnative', :subspecs => [${subspecList}], :path => '${resolvedPath}'`;
}

// TEMPORARY (REL-1): Live Activities are not on the CocoaPods trunk yet. The `liveactivities`
// subspec depends on `CustomerIO/LiveActivities`, and the widget links the templates and attributes
// pods directly — none of which exist in a released `CustomerIO` podspec. Resolve the whole
// Customer.io iOS SDK from the branch that carries them instead.
//
// Every pod the host app pulls has to be listed: CocoaPods refuses to mix a git-sourced pod with
// trunk-sourced pods that share its dependency graph. Delete this and the two call sites once Live
// Activities ship in a released native SDK.
const UNRELEASED_IOS_SDK_GIT = 'https://github.com/customerio/customerio-ios.git';
const UNRELEASED_IOS_SDK_BRANCH = 'feat/live-activities';

/**
 * The pods the host app actually resolves, which is what may be listed: a `pod` line *adds* a
 * dependency, so naming one the app doesn't use changes its build. That matters most for the push
 * provider — listing the FCM pod in an APN app would pull Firebase in, the very thing the
 * `customerio-reactnative` podspec splits its subspecs to avoid.
 */
function hostUnreleasedPods(
  isFcmPushProvider: boolean,
  locationEnabled: boolean
): string[] {
  return [
    // `CustomerIO` and its transitive modules are in the graph on every configuration.
    'CustomerIO',
    'CustomerIOCommon',
    'CustomerIODataPipelines',
    'CustomerIOTrackingMigration',
    'CustomerIOMessagingPush',
    'CustomerIOMessagingInApp',
    isFcmPushProvider ? 'CustomerIOMessagingPushFCM' : 'CustomerIOMessagingPushAPN',
    ...(locationEnabled ? ['CustomerIOLocation'] : []),
    'CustomerIOLiveActivities',
    'CustomerIOLiveActivitiesAttributes',
    'CustomerIOLiveActivitiesTemplates',
  ];
}

const WIDGET_UNRELEASED_PODS = [
  'CustomerIOLiveActivitiesTemplates',
  'CustomerIOLiveActivitiesAttributes',
];

/** `pod` lines resolving `pods` from the unreleased Live Activities branch, one per line. */
function unreleasedPodLines(pods: string[], indent: string): string {
  return pods
    .map(
      (pod) =>
        `${indent}pod '${pod}', :git => '${UNRELEASED_IOS_SDK_GIT}', :branch => '${UNRELEASED_IOS_SDK_BRANCH}'`
    )
    .join('\n');
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

  // TEMPORARY (REL-1): only Live Activities need the unreleased branch, so apps without them keep
  // resolving from the CocoaPods trunk and their Podfile is byte-identical to before.
  const unreleasedPods = options?.liveNotificationsEnabled
    ? `\n${unreleasedPodLines(
        hostUnreleasedPods(isFcmPushProvider, options.locationEnabled === true),
        '  '
      )}`
    : '';

  const snippetToInjectInPodfile = `
${HOST_APP_BLOCK_START}
  ${podLine}${unreleasedPods}
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

/**
 * Pure string transform: given the existing Podfile contents, returns the Podfile with the Live
 * Activity widget target block appended at the end. The widget links the Customer.io iOS SDK's Live
 * Activity template + attributes pods (published to CocoaPods on release). Idempotent — returns
 * input unchanged if the block is already present. Exported for tests.
 */
export function appendLiveActivityWidgetTargetToPodfile(
  podfileContent: string,
  useFrameworks: CustomerIOPluginOptionsIOS['useFrameworks'],
): string {
  if (podfileContent.match(new RegExp(LIVE_ACTIVITY_BLOCK_START))) {
    return podfileContent;
  }

  const snippetToAppend = `
${LIVE_ACTIVITY_BLOCK_START}
target '${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME}' do
  ${useFrameworks === 'static' ? 'use_frameworks! :linkage => :static' : ''}
${unreleasedPodLines(WIDGET_UNRELEASED_PODS, '  ')}
end
${LIVE_ACTIVITY_BLOCK_END}
`.trim();

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
    await FileManagement.append(filename, next.slice(podfile.length));
  }
}
