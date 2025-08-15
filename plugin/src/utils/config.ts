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
  const nativeCdpApiKey = nativeConfig?.cdpApiKey;
  const nativeRegion = nativeConfig?.region;

  const envConfig = props.pushNotification?.env;
  const envCdpApiKey = envConfig?.cdpApiKey;
  const envRegion = envConfig?.region;

  // Check for conflicts between env and nativeConfig
  if (nativeCdpApiKey && envCdpApiKey) {
    if (nativeCdpApiKey !== envCdpApiKey || nativeRegion?.toLowerCase() !== envRegion?.toLowerCase()) {
      const errorMessage = `Configuration conflict: 'config' and 'ios.pushNotification.env' values must match when both are provided.\n` +
        `  config.cdpApiKey: "${nativeCdpApiKey}"\n` +
        `  env.cdpApiKey: "${envCdpApiKey}"\n` +
        `  config.region: "${nativeRegion}"\n` +
        `  env.region: "${envRegion}"`;

      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Values match - warn about redundant configuration
    console.warn(
      `Both 'config' and 'ios.pushNotification.env' are provided with matching values. ` +
      `Consider removing 'ios.pushNotification.env' since 'config' is already specified.`
    );
  }

  // Return config (values are guaranteed to be the same if both exist)
  const cdpApiKey = nativeCdpApiKey || envCdpApiKey;
  const region = nativeRegion || envRegion;

  if (cdpApiKey) {
    return {
      cdpApiKey,
      region,
    };
  }

  return undefined;
}

export { mergeConfigWithEnvValues };
