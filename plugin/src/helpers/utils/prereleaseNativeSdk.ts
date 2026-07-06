// TEMP (pre-release native SDKs). This module and its two callers exist only so the sample app
// can build against native SDK code that is merged but not published yet. The whole thing is
// reverted as one commit once the native SDKs ship.
//
// Switching to the next pre-release feature is normally a one-line change: point
// NATIVE_SDK_BRANCH at the branch carrying it. Two other knobs, only if that feature needs them:
//   - EXTRA_CIO_PODS — iOS subspecs the published trunk podspec doesn't carry yet
//   - `customerio-reactnative` in test-app/package.json — the RN wrapper's own branch

/** Branch of customerio-ios / customerio-android to build against. */
export const NATIVE_SDK_BRANCH = 'main';

/** Subspecs missing from the trunk CustomerIO podspec, pulled straight from git instead. */
export const EXTRA_CIO_PODS = ['CustomerIO/LocationGeofence'];

const CIO_IOS_GIT_URL = 'https://github.com/customerio/customerio-ios.git';
const CIO_IOS_OVERRIDE_SCRIPT = `https://raw.githubusercontent.com/customerio/customerio-ios/${NATIVE_SDK_BRANCH}/scripts/cocoapods_override_sdk.rb`;

export const CIO_ANDROID_SNAPSHOT_REPO =
  'https://central.sonatype.com/repository/maven-snapshots/';

/** Marker used to keep both injections idempotent, and to spot them in generated output. */
export const PRERELEASE_MARKER = 'CustomerIO pre-release native SDK';

/** Android publishes per-branch snapshots as `<branch with / replaced by ->-SNAPSHOT`. */
export function androidSnapshotVersion(branch: string = NATIVE_SDK_BRANCH): string {
  return `${branch.replace(/\//g, '-')}-SNAPSHOT`;
}

/**
 * Ruby snippet that repoints the whole CustomerIO iOS SDK at NATIVE_SDK_BRANCH, mirroring the
 * customerio-reactnative example Podfile. Needed because customerio-reactnative pins trunk
 * podspec versions, which don't carry unreleased subspecs.
 */
function buildPodfileOverride(isFcmPushProvider: boolean): string {
  const pushService = isFcmPushProvider ? 'fcm' : 'apn';
  const extraPods = EXTRA_CIO_PODS.map(
    (pod) =>
      `\n  pod '${pod}', :git => '${CIO_IOS_GIT_URL}', :branch => '${NATIVE_SDK_BRANCH}'`
  ).join('');

  return `  # TEMP: ${PRERELEASE_MARKER} (branch: ${NATIVE_SDK_BRANCH}). Revert once it ships.
  require 'open-uri'
  IO.copy_stream(URI.open('${CIO_IOS_OVERRIDE_SCRIPT}'), "/tmp/override_cio_sdk.rb")
  load "/tmp/override_cio_sdk.rb"
  install_non_production_ios_sdk_git_branch(branch_name: '${NATIVE_SDK_BRANCH}', is_app_extension: false, push_service: '${pushService}')${extraPods}`;
}

/**
 * Pure string transform: injects the override into the app target, immediately before the Expo
 * `post_install` anchor (the same anchor the CustomerIO host-app block uses, so the override
 * lands inside the target block). Idempotent.
 *
 * Exported for tests.
 */
export function injectPrereleasePodfileOverride(
  podfileContent: string,
  isFcmPushProvider: boolean
): string {
  if (podfileContent.includes(PRERELEASE_MARKER)) {
    return podfileContent;
  }

  const anchor = /^(\s*)post_install do \|installer\|/m;
  const match = podfileContent.match(anchor);
  if (!match) {
    return podfileContent;
  }

  return podfileContent.replace(
    anchor,
    `${buildPodfileOverride(isFcmPushProvider)}\n${match[0]}`
  );
}

/**
 * Pure string transform: adds the Sonatype snapshots repo and repoints `cioSDKVersionAndroid`
 * (which customerio-reactnative reads from rootProject.ext) at the branch SNAPSHOT. Idempotent.
 *
 * Exported for tests.
 */
export function injectPrereleaseProjectBuildGradle(contents: string): string {
  if (contents.includes(PRERELEASE_MARKER)) {
    return contents;
  }

  const snippet = `
    // TEMP: ${PRERELEASE_MARKER}. Revert once it ships.
    repositories {
        maven { url '${CIO_ANDROID_SNAPSHOT_REPO}' }
    }
    ext.cioSDKVersionAndroid = "${androidSnapshotVersion()}"`;

  return contents.replace(/allprojects\s*\{/, `allprojects {${snippet}`);
}
