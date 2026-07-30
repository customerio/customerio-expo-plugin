import type { GeofenceLocationMode } from '../../types/cio-types';
import { PLATFORM, type Platform } from '../constants/common';

const VALID_LOCATION_MODES: GeofenceLocationMode[] = ['AUTOMATIC', 'MANUAL'];

/** Options for geofence module in generated native initializer */
export type GeofenceInitOptions = {
  enabled: boolean;
  locationMode?: GeofenceLocationMode;
  /** iOS-only. Defaults to true when geofence is enabled. */
  allowBackgroundDelivery?: boolean;
};

// Returns the mode only when the customer set a valid value. When unset (or invalid) we return
// undefined so the generated code omits the setter and defers to the native SDK's own default
// (AUTOMATIC today) — the plugin never hard-codes a default the SDK might later change.
function normalizeLocationMode(
  rawMode: string | undefined
): GeofenceLocationMode | undefined {
  const upper = rawMode?.toUpperCase();
  return upper && VALID_LOCATION_MODES.includes(upper as GeofenceLocationMode)
    ? (upper as GeofenceLocationMode)
    : undefined;
}

/**
 * Replaces {{GEOFENCE_MODULE_IMPORT}} and {{GEOFENCE_MODULE_INIT}} placeholders
 * in SDK initializer template content for the given platform. When geofence is
 * disabled, the placeholders are stripped.
 */
export function patchGeofencePlaceholders(
  content: string,
  platform: Platform,
  geofenceOptions?: GeofenceInitOptions
): string {
  const geofenceEnabled = geofenceOptions?.enabled === true;
  const locationMode = normalizeLocationMode(geofenceOptions?.locationMode);

  if (platform === PLATFORM.ANDROID) {
    if (geofenceEnabled) {
      // Only import GeofenceLocationMode / call setLocationMode when a mode was provided.
      const imports = [
        ...(locationMode ? ['import io.customer.geofence.GeofenceLocationMode'] : []),
        'import io.customer.geofence.GeofenceModuleConfig',
        'import io.customer.geofence.ModuleGeofence',
      ].join('\n') + '\n';
      const geofenceConfig = locationMode
        ? `GeofenceModuleConfig.Builder()
                        .setLocationMode(GeofenceLocationMode.${locationMode})
                        .build()`
        : 'GeofenceModuleConfig.Builder().build()';
      return content
        .replace(/\{\{GEOFENCE_MODULE_IMPORT\}\}/g, imports)
        .replace(
          /\{\{GEOFENCE_MODULE_INIT\}\}/g,
          `if (io.customer.reactnative.sdk.BuildConfig.CIO_GEOFENCE_ENABLED) {
            addCustomerIOModule(
                ModuleGeofence(
                    ${geofenceConfig}
                )
            )
        }
        `
        );
    }
    return content
      .replace(/\n\{\{GEOFENCE_MODULE_IMPORT\}\}\n/g, '\n')
      .replace(/\n[ \t]*\{\{GEOFENCE_MODULE_INIT\}\}\n/g, '\n');
  }

  // iOS
  if (geofenceEnabled) {
    // Only pass locationMode when provided; otherwise defer to GeofenceModuleConfig's default.
    const geofenceConfig = locationMode
      ? `GeofenceModuleConfig(locationMode: ${locationMode === 'MANUAL' ? '.manual' : '.automatic'})`
      : 'GeofenceModuleConfig()';
    // Background delivery lets geofence transitions be sent while the app is backgrounded, so we
    // default it on when the geofence module is added — it gives better delivery of geofence events.
    // Customers can still override it, and non-geofence apps don't need it, so it stays off otherwise.
    const allowBackgroundDelivery = geofenceOptions?.allowBackgroundDelivery ?? true;
    return content
      .replace(/\{\{GEOFENCE_MODULE_IMPORT\}\}/g, 'import CioLocationGeofence\n')
      .replace(
        /\{\{GEOFENCE_MODULE_INIT\}\}/g,
        `_ = builder.addModule(GeofenceModule(config: ${geofenceConfig}))
        _ = builder.allowBackgroundDelivery(${allowBackgroundDelivery})`
      );
  }
  return content
    .replace(/\n\{\{GEOFENCE_MODULE_IMPORT\}\}\n/g, '\n')
    .replace(/\n[ \t]*\{\{GEOFENCE_MODULE_INIT\}\}\n/g, '\n');
}
