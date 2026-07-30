import type { ConfigPlugin, ExportedConfigWithProps } from '@expo/config-plugins';
import { withMainApplication } from '@expo/config-plugins';
import type { ApplicationProjectFile } from '@expo/config-plugins/build/android/Paths';
import { CIO_MAINAPPLICATION_ONCREATE_REGEX, CIO_NATIVE_SDK_INITIALIZE_CALL, CIO_NATIVE_SDK_INITIALIZE_SNIPPET } from '../helpers/constants/android';
import { PLATFORM } from '../helpers/constants/common';
import { patchNativeSDKInitializer } from '../helpers/utils/patchPluginNativeCode';
import type {
  CustomerIOPluginLocationOptions,
  CustomerIOPluginGeofenceOptions,
  NativeSDKConfig,
} from '../types/cio-types';
import { addCodeToMethod, addImportToFile, copyTemplateFile } from '../utils/android';
import { logger } from '../utils/logger';

type MainApplicationModParams = {
  sdkConfig: NativeSDKConfig;
  location?: CustomerIOPluginLocationOptions;
  geofence?: CustomerIOPluginGeofenceOptions;
};

export const withMainApplicationModifications: ConfigPlugin<MainApplicationModParams> = (configOuter, { sdkConfig, location, geofence }) => {
  return withMainApplication(configOuter, async (config) => {
    const content = setupCustomerIOSDKInitializer(config, sdkConfig, location, geofence);
    config.modResults.contents = content;
    return config;
  });
};

/**
 * Build location options for native initializer from plugin config.
 * trackingMode comes from config.location.trackingMode. Geofence implies location, so the
 * location module is registered whenever location or geofence is enabled.
 */
const getLocationInitOptions = (
  location?: CustomerIOPluginLocationOptions,
  geofence?: CustomerIOPluginGeofenceOptions,
  sdkConfig?: NativeSDKConfig
) => ({
  enabled: location?.enabled === true || geofence?.enabled === true,
  trackingMode: sdkConfig?.location?.trackingMode,
});

/**
 * Build geofence options for native initializer from plugin config.
 * locationMode comes from config.geofence.locationMode (only used when geofence.enabled is true).
 */
const getGeofenceInitOptions = (
  geofence?: CustomerIOPluginGeofenceOptions,
  sdkConfig?: NativeSDKConfig
) => ({
  enabled: geofence?.enabled === true,
  locationMode: sdkConfig?.geofence?.locationMode,
});

const SDK_INITIALIZER_CLASS = 'CustomerIOSDKInitializer';
const SDK_INITIALIZER_PACKAGE = 'io.customer.sdk.expo';
const SDK_INITIALIZER_FILE = `${SDK_INITIALIZER_CLASS}.kt`;
const SDK_INITIALIZER_IMPORT = `import ${SDK_INITIALIZER_PACKAGE}.${SDK_INITIALIZER_CLASS}`;

/**
 * Pure string transform: given the existing MainApplication contents, returns the contents
 * with the CustomerIOSDKInitializer import and onCreate call injected (idempotent — if the
 * initialize call is already present, the call-injection step is skipped).
 */
export function injectCustomerIOInitializerIntoMainApplication(
  contents: string
): string {
  let next = addImportToFile(contents, SDK_INITIALIZER_IMPORT);
  if (!next.includes(CIO_NATIVE_SDK_INITIALIZE_CALL)) {
    next = addCodeToMethod(
      next,
      CIO_MAINAPPLICATION_ONCREATE_REGEX,
      CIO_NATIVE_SDK_INITIALIZE_SNIPPET
    );
  }
  return next;
}

/**
 * Setup CustomerIOSDKInitializer for Android auto initialization
 */
const setupCustomerIOSDKInitializer = (
  config: ExportedConfigWithProps<ApplicationProjectFile>,
  sdkConfig: NativeSDKConfig,
  location?: CustomerIOPluginLocationOptions,
  geofence?: CustomerIOPluginGeofenceOptions,
): string => {
  const locationOptions = getLocationInitOptions(location, geofence, sdkConfig);
  const geofenceOptions = getGeofenceInitOptions(geofence, sdkConfig);

  try {
    // Always regenerate the CustomerIOSDKInitializer file to reflect config changes
    copyTemplateFile(config, SDK_INITIALIZER_FILE, SDK_INITIALIZER_PACKAGE, (content) =>
      patchNativeSDKInitializer(content, PLATFORM.ANDROID, sdkConfig, locationOptions, geofenceOptions)
    );
    return injectCustomerIOInitializerIntoMainApplication(config.modResults.contents);
  } catch (error) {
    logger.warn(`Could not setup ${SDK_INITIALIZER_CLASS}:`, error);
    return config.modResults.contents;
  }
};
