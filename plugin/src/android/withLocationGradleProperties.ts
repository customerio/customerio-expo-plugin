import type { ConfigPlugin } from '@expo/config-plugins';
import { withGradleProperties } from '@expo/config-plugins';
import type { PropertiesItem } from '@expo/config-plugins/build/android/Properties';

import type { CustomerIOPluginLocationOptions } from '../types/cio-types';

const CUSTOMERIO_LOCATION_ENABLED_KEY = 'customerio_location_enabled';

/**
 * Adds or updates customerio_location_enabled in android/gradle.properties when location.enabled is true.
 * The Customer.io React Native SDK reads this to enable the location native module.
 */
export const withLocationGradleProperties: ConfigPlugin<{
  location?: CustomerIOPluginLocationOptions;
}> = (config, props) => {
  if (props?.location?.enabled !== true) {
    return config;
  }

  return withGradleProperties(config, (config) => {
    const items = config.modResults as PropertiesItem[];
    const existingIndex = items.findIndex(
      (item) => item.type === 'property' && item.key === CUSTOMERIO_LOCATION_ENABLED_KEY
    );

    const newItem: PropertiesItem = {
      type: 'property',
      key: CUSTOMERIO_LOCATION_ENABLED_KEY,
      value: 'true',
    };

    if (existingIndex >= 0) {
      items[existingIndex] = newItem;
    } else {
      items.push(newItem);
    }

    config.modResults = items;
    return config;
  });
};
