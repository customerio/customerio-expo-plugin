import type { LocationTrackingMode } from '../../types/cio-types';
import { PLATFORM, type Platform } from '../constants/common';

const VALID_TRACKING_MODES: LocationTrackingMode[] = ['OFF', 'MANUAL', 'ON_APP_START'];

/** Options for location module in generated native initializer */
export type LocationInitOptions = {
  enabled: boolean;
  trackingMode?: LocationTrackingMode;
};

function normalizeTrackingMode(
  rawMode: string | undefined
): LocationTrackingMode {
  const upper = rawMode?.toUpperCase();
  return upper && VALID_TRACKING_MODES.includes(upper as LocationTrackingMode)
    ? (upper as LocationTrackingMode)
    : 'MANUAL';
}

/**
 * Replaces {{LOCATION_MODULE_IMPORT}} and {{LOCATION_MODULE_INIT}} placeholders
 * in SDK initializer template content for the given platform.
 */
export function patchLocationPlaceholders(
  content: string,
  platform: Platform,
  locationOptions?: LocationInitOptions
): string {
  const locationEnabled = locationOptions?.enabled === true;
  const trackingMode = normalizeTrackingMode(locationOptions?.trackingMode);

  if (platform === PLATFORM.ANDROID) {
    if (locationEnabled) {
      return content
        .replace(
          /\{\{LOCATION_MODULE_IMPORT\}\}/g,
          `import io.customer.location.LocationModuleConfig
import io.customer.location.LocationTrackingMode
import io.customer.location.ModuleLocation
`
        )
        .replace(
          /\{\{LOCATION_MODULE_INIT\}\}/g,
          `if (io.customer.reactnative.sdk.BuildConfig.CIO_LOCATION_ENABLED) {
            addCustomerIOModule(
                ModuleLocation(
                    LocationModuleConfig.Builder()
                        .setLocationTrackingMode(LocationTrackingMode.${trackingMode})
                        .build()
                )
            )
        }
        `
        );
    }
    return content
      .replace(/\n\{\{LOCATION_MODULE_IMPORT\}\}\n/g, '\n')
      .replace(/\n\s*\{\{LOCATION_MODULE_INIT\}\}\n/g, '\n');
  }

  // iOS
  if (locationEnabled) {
    const modeSwift =
      trackingMode === 'OFF'
        ? '.off'
        : trackingMode === 'ON_APP_START'
          ? '.onAppStart'
          : '.manual';
    return content
      .replace(/\{\{LOCATION_MODULE_IMPORT\}\}/g, 'import CioLocation\n')
      .replace(
        /\{\{LOCATION_MODULE_INIT\}\}/g,
        `_ = builder.addModule(LocationModule(config: LocationConfig(mode: ${modeSwift})))`
      );
  }
  return content
    .replace(/\n\{\{LOCATION_MODULE_IMPORT\}\}\n/g, '\n')
    .replace(/\n\s*\{\{LOCATION_MODULE_INIT\}\}\n/g, '\n\n');
}
