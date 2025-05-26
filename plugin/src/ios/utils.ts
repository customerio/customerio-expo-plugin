import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import type { ExpoConfig } from '@expo/config-types';

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
  const parsedMajorVersion = parseInt(sdkVersion.split('.')[0], 10);

  if (isNaN(parsedMajorVersion)) return false;

  return parsedMajorVersion >= 53;
};
