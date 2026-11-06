import type { CustomerIOPluginOptionsIOS, NativeSDKConfig, RichPushConfig } from '../types/cio-types';
import { resolveRegion } from '../helpers/utils/cdpApiKey';
import { logger } from './logger';

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
  // A key like pk_eu_ carries its region, so use it when none is set. The app initializer does
  // the same, which keeps the app and the notification extension on one region.
  const nativeRegion = resolveRegion(nativeConfig?.region, nativeCdpApiKey);

  const envConfig = props.pushNotification?.env;
  const envCdpApiKey = envConfig?.cdpApiKey;
  const envRegion = resolveRegion(envConfig?.region, envCdpApiKey);

  // Check for conflicts between env and nativeConfig
  if (nativeCdpApiKey && envCdpApiKey) {
    if (nativeCdpApiKey !== envCdpApiKey || nativeRegion?.toLowerCase() !== envRegion?.toLowerCase()) {
      const errorMessage = `Configuration conflict: 'config' and 'ios.pushNotification.env' values must match when both are provided.\n` +
        `  config.cdpApiKey: "${nativeCdpApiKey}"\n` +
        `  env.cdpApiKey: "${envCdpApiKey}"\n` +
        `  config.region: "${nativeRegion}"\n` +
        `  env.region: "${envRegion}"`;

      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Values match - warn about redundant configuration
    logger.warn(
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

/**
 * Host the Notification Service Extension sends delivery metrics to. Falls back to `config.apiHost`
 * so apps on native auto-init only set the proxy once.
 */
function resolveNseApiHost(
  props: CustomerIOPluginOptionsIOS,
  nativeConfig?: NativeSDKConfig
): string | undefined {
  const nseApiHost = props.pushNotification?.apiHost;
  const nativeApiHost = nativeConfig?.apiHost;
  const nse = typeof nseApiHost === 'string' ? nseApiHost.trim() : '';
  const native = typeof nativeApiHost === 'string' ? nativeApiHost.trim() : '';

  if (!native) return nseApiHost;
  if (!nse) return native;

  if (nse === native) {
    logger.warn(
      `Both 'config.apiHost' and 'ios.pushNotification.apiHost' are set to the same value. ` +
        `Consider removing 'ios.pushNotification.apiHost' since 'config.apiHost' already applies to the notification extension.`
    );
  } else {
    logger.warn(
      `'config.apiHost' ("${native}") and 'ios.pushNotification.apiHost' ("${nse}") differ. ` +
        `The notification extension uses 'ios.pushNotification.apiHost'.`
    );
  }
  return nseApiHost;
}

export { mergeConfigWithEnvValues, resolveNseApiHost };
