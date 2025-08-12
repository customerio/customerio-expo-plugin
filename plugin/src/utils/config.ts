import type { CustomerIOPluginOptionsIOS, NativeSDKConfig, RichPushConfig } from '../types/cio-types';

/**
 * Merges config values with env values for backward compatibility.
 * If env is provided, it takes precedence. If nativeConfig is provided but env is not,
 * nativeConfig values are used. This prioritizes existing env configuration for backward compatibility.
 */
function mergeConfigWithEnvValues(
  props: CustomerIOPluginOptionsIOS,
  nativeConfig?: NativeSDKConfig
): RichPushConfig | undefined {
  // First priority: env values (backward compatibility)
  const envConfig = props.pushNotification?.env;
  if (envConfig?.cdpApiKey) {
    return {
      cdpApiKey: envConfig.cdpApiKey,
      region: envConfig.region,
    };
  }

  // Second priority: config values
  if (nativeConfig?.cdpApiKey) {
    return {
      cdpApiKey: nativeConfig.cdpApiKey,
      region: nativeConfig.region,
    };
  }

  // No values provided
  return undefined;
}

export { mergeConfigWithEnvValues };
