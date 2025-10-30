import type { ExpoConfig } from '@expo/config-types';
import * as semver from 'semver';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';

/**
 * Returns true if FCM is configured to be used as push provider
 * @param iosOptions The plugin iOS configuration options
 * @returns true if FCM is configured to be used as push provider
 */
export const isFcmPushProvider = (
  iosOptions?: CustomerIOPluginOptionsIOS
): boolean => {
  return iosOptions?.pushNotification?.provider === 'fcm';
};

/** Checks if Expo SDK version meets minimum version requirement */
function isExpoVersionOrHigher(config: ExpoConfig, minVersion: string): boolean {
  const sdkVersion = config.sdkVersion || '';
  const validVersion = semver.valid(sdkVersion) || semver.coerce(sdkVersion);
  if (!validVersion) return false;
  return semver.gte(validVersion, minVersion);
}

/** Returns true if Expo SDK version is >= 53.0.0 */
export const isExpoVersion53OrHigher = (config: ExpoConfig): boolean => {
  return isExpoVersionOrHigher(config, '53.0.0');
};

/** Returns true if Expo SDK version is <= 53.x.x (used for Android 16 compat detection) */
export const isExpoVersion53OrLower = (config: ExpoConfig): boolean => {
  return !isExpoVersionOrHigher(config, '54.0.0');
};
