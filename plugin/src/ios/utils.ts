import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import type { ExpoConfig } from '@expo/config-types';
import * as semver from 'semver';

/**
 * Returns t
 * @param iosOptions The plugin iOS configuration options
 * @returns true if FCM is configured to be used as push provider
 */
export const isFcmPushProvider = (
  iosOptions?: CustomerIOPluginOptionsIOS
): boolean => {
  return iosOptions?.pushNotification?.provider === 'fcm';
};

export const isExpoVersion53OrHigher = (config: ExpoConfig): boolean => {
  const sdkVersion = config.sdkVersion || '';
  
  // If sdkVersion is not a valid semver, coerce it to a valid one if possible
  const validVersion = semver.valid(sdkVersion) || semver.coerce(sdkVersion);
  
  // If we couldn't get a valid version, return false
  if (!validVersion) return false;
  
  // Check if the version is greater than or equal to 53.0.0
  return semver.gte(validVersion, '53.0.0');
};
