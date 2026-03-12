import type { ConfigPlugin, ExportedConfigWithProps } from '@expo/config-plugins';
import { withMainApplication } from '@expo/config-plugins';
import type { ApplicationProjectFile } from '@expo/config-plugins/build/android/Paths';
import { CIO_MAINAPPLICATION_ONCREATE_REGEX, CIO_NATIVE_SDK_INITIALIZE_CALL, CIO_NATIVE_SDK_INITIALIZE_SNIPPET } from '../helpers/constants/android';
import { PLATFORM } from '../helpers/constants/common';
import { patchNativeSDKInitializer } from '../helpers/utils/patchPluginNativeCode';
import type {
  CustomerIOPluginLocationOptions,
  NativeSDKConfig,
} from '../types/cio-types';
import { addCodeToMethod, addImportToFile, copyTemplateFile } from '../utils/android';
import { logger } from '../utils/logger';

type MainApplicationModParams = {
  sdkConfig: NativeSDKConfig;
  location?: CustomerIOPluginLocationOptions;
};

export const withMainApplicationModifications: ConfigPlugin<MainApplicationModParams> = (configOuter, { sdkConfig, location }) => {
  return withMainApplication(configOuter, async (config) => {
    const content = setupCustomerIOSDKInitializer(config, sdkConfig, location);
    config.modResults.contents = content;
    return config;
  });
};

/**
 * Build location options for native initializer from plugin config.
 * trackingMode comes from config.location.trackingMode (only used when location.enabled is true).
 */
const getLocationInitOptions = (
  location?: CustomerIOPluginLocationOptions,
  sdkConfig?: NativeSDKConfig
) => ({
  enabled: location?.enabled === true,
  trackingMode: sdkConfig?.location?.trackingMode,
});

/**
 * Setup CustomerIOSDKInitializer for Android auto initialization
 */
const setupCustomerIOSDKInitializer = (
  config: ExportedConfigWithProps<ApplicationProjectFile>,
  sdkConfig: NativeSDKConfig,
  location?: CustomerIOPluginLocationOptions,
): string => {
  const SDK_INITIALIZER_CLASS = 'CustomerIOSDKInitializer';
  const SDK_INITIALIZER_PACKAGE = 'io.customer.sdk.expo';

  const SDK_INITIALIZER_FILE = `${SDK_INITIALIZER_CLASS}.kt`;
  const SDK_INITIALIZER_IMPORT = `import ${SDK_INITIALIZER_PACKAGE}.${SDK_INITIALIZER_CLASS}`;

  const locationOptions = getLocationInitOptions(location, sdkConfig);
  let content = config.modResults.contents;

  try {
    // Always regenerate the CustomerIOSDKInitializer file to reflect config changes
    copyTemplateFile(config, SDK_INITIALIZER_FILE, SDK_INITIALIZER_PACKAGE, (content) =>
      patchNativeSDKInitializer(content, PLATFORM.ANDROID, sdkConfig, locationOptions)
    );
    // Add import if not already present
    content = addImportToFile(content, SDK_INITIALIZER_IMPORT);
    // Add initialization code to onCreate if not already present
    if (!content.includes(CIO_NATIVE_SDK_INITIALIZE_CALL)) {
      content = addCodeToMethod(content, CIO_MAINAPPLICATION_ONCREATE_REGEX, CIO_NATIVE_SDK_INITIALIZE_SNIPPET);
    }
  } catch (error) {
    logger.warn(`Could not setup ${SDK_INITIALIZER_CLASS}:`, error);
    return config.modResults.contents;
  }

  return content;
};
