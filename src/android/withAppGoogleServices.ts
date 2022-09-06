import { withProjectBuildGradle, ConfigPlugin } from '@expo/config-plugins';

import { CustomerIOPluginOptions } from '../types/cio-types';

export const withAppGoogleServices: ConfigPlugin<CustomerIOPluginOptions> = (
  configOuter,
) => {
  const allProjectsRegex = /(buildscript\s*\{.|\n*dependencies\s*\{)/;
  const googleServicesString =
    '        classpath "com.google.gms:google-services:4.3.13"  // Google Services plugin';

  return withProjectBuildGradle(configOuter, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      allProjectsRegex,
      `$1\n${googleServicesString}`,
    );
    return config;
  });
};
