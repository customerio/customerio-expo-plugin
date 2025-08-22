import type { NativeSDKConfig } from '../../types/cio-types';
import { PLATFORM, type Platform } from '../constants/common';
import { getPluginVersion } from '../../utils/plugin';

/**
 * Shared utility function to perform common SDK config replacements
 * for both iOS and Android template files
 */
export function patchNativeSDKInitializer(
  rawContent: string,
  platform: Platform,
  sdkConfig: NativeSDKConfig
): string {
  let content = rawContent;

  // Helper function to replace placeholders with platform-specific fallback values
  const replaceValue = <T>(
    placeholder: RegExp,
    value: T | undefined,
    transform: (configValue: T) => string,
    fallback: string = platform === PLATFORM.ANDROID ? 'null' : 'nil'
  ) => {
    if (value !== undefined && value !== null) {
      content = content.replace(placeholder, transform(value));
    } else {
      content = content.replace(placeholder, fallback);
    }
  };

  // Replace EXPO_PLUGIN_VERSION with actual plugin version
  const pluginVersion = getPluginVersion();
  content = content.replace(/\{\{EXPO_PLUGIN_VERSION\}\}/g, pluginVersion);

  // Replace CDP API Key (required field)
  content = content.replace(/\{\{CDP_API_KEY\}\}/g, sdkConfig.cdpApiKey);

  // Handle region - use empty string as fallback (nil not supported for region)
  replaceValue(
    /\{\{REGION\}\}/g,
    sdkConfig.region,
    (configValue) => `"${configValue}"`,
    '""'
  );

  // Handle logLevel - use nil/null as fallback
  replaceValue(
    /\{\{LOG_LEVEL\}\}/g,
    sdkConfig.logLevel,
    (configValue) => `"${configValue}"`
  );

  // Handle optional boolean configurations
  replaceValue(
    /\{\{AUTO_TRACK_DEVICE_ATTRIBUTES\}\}/g,
    sdkConfig.autoTrackDeviceAttributes,
    (configValue) => configValue.toString()
  );

  replaceValue(
    /\{\{TRACK_APPLICATION_LIFECYCLE_EVENTS\}\}/g,
    sdkConfig.trackApplicationLifecycleEvents,
    (configValue) => configValue.toString()
  );

  // Handle screenViewUse - use nil/null as fallback
  replaceValue(
    /\{\{SCREEN_VIEW_USE\}\}/g,
    sdkConfig.screenViewUse,
    (configValue) => `"${configValue}"`
  );

  // Handle siteId/migrationSiteId business logic
  let siteId = sdkConfig.siteId;
  let migrationSiteId = sdkConfig.migrationSiteId;

  // Business rule: if only siteId provided, copy to migrationSiteId; if only migrationSiteId provided, set siteId to undefined
  if (siteId && !migrationSiteId) {
    migrationSiteId = siteId;
  } else if (migrationSiteId && !siteId) {
    siteId = undefined;
  }

  // Replace siteId and migrationSiteId placeholders (trim whitespace and handle empty strings)
  replaceValue(
    /\{\{SITE_ID\}\}/g,
    siteId?.trim() || undefined,
    (configValue) => `"${configValue}"`
  );

  replaceValue(
    /\{\{MIGRATION_SITE_ID\}\}/g,
    migrationSiteId?.trim() || undefined,
    (configValue) => `"${configValue}"`
  );

  return content;
}
