import type { ConfigPlugin } from '@expo/config-plugins';
import { withGradleProperties } from '@expo/config-plugins';
import type { PropertiesItem } from '@expo/config-plugins/build/android/Properties';

import type { CustomerIOPluginGeofenceOptions } from '../types/cio-types';

const CUSTOMERIO_GEOFENCE_ENABLED_KEY = 'customerio_geofence_enabled';

export function modifyGeofenceGradleProperties(
  items: PropertiesItem[]
): PropertiesItem[] {
  const existingIndex = items.findIndex(
    (item) => item.type === 'property' && item.key === CUSTOMERIO_GEOFENCE_ENABLED_KEY
  );

  const newItem: PropertiesItem = {
    type: 'property',
    key: CUSTOMERIO_GEOFENCE_ENABLED_KEY,
    value: 'true',
  };

  if (existingIndex >= 0) {
    items[existingIndex] = newItem;
  } else {
    items.push(newItem);
  }

  return items;
}

/**
 * Adds or updates customerio_geofence_enabled in android/gradle.properties when geofence.enabled is true.
 * The Customer.io React Native SDK reads this to enable the geofence native module; geofence implies location,
 * so the SDK also enables the location module from this flag alone.
 */
export const withGeofenceGradleProperties: ConfigPlugin<{
  geofence?: CustomerIOPluginGeofenceOptions;
}> = (config, props) => {
  if (props?.geofence?.enabled !== true) {
    return config;
  }

  return withGradleProperties(config, (config) => {
    const items = config.modResults as PropertiesItem[];
    config.modResults = modifyGeofenceGradleProperties(items);
    return config;
  });
};
