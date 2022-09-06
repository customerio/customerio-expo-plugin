import { withAppBuildGradle, ConfigPlugin } from '@expo/config-plugins';

import { CustomerIOPluginOptions } from '../types/cio-types';

export const withProjectGoogleServices: ConfigPlugin<
  CustomerIOPluginOptions
> = (configOuter) => {
  const allProjectsRegex = /(apply plugin: "com.android.application")/;
  const additionalMavenRepositoryString =
    'apply plugin: "com.google.gms.google-services"  // Google Services plugin';

  return withAppBuildGradle(configOuter, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      allProjectsRegex,
      `$1\n${additionalMavenRepositoryString}`,
    );
    return config;
  });
};
