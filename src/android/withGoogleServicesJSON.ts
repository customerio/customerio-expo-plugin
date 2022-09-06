import { withProjectBuildGradle, ConfigPlugin } from '@expo/config-plugins';
import { copyFileSync } from 'fs';

import { CustomerIOPluginOptions } from '../types/cio-types';

export const withGoogleServicesJSON: ConfigPlugin<CustomerIOPluginOptions> = (
  configOuter,
) => {
  return withProjectBuildGradle(configOuter, (config) => {
    const path = config.modRequest.platformProjectRoot;
    const sourceDir = 'plugin/helpers/android/';
    copyFileSync(
      `${sourceDir}google-services.json`,
      `${path}/app/google-services.json`,
    );

    return config;
  });
};
