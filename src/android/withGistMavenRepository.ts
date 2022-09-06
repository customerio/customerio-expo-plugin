import { withProjectBuildGradle, ConfigPlugin } from '@expo/config-plugins';

import { CustomerIOPluginOptions } from '../types/cio-types';

export const withGistMavenRepository: ConfigPlugin<CustomerIOPluginOptions> = (
  configOuter,
) => {
  const allProjectsRegex = /(allprojects\s*\{.|\n*repositories\s*\{)/;
  const additionalMavenRepositoryString =
    '        maven { url "https://maven.gist.build" }';

  return withProjectBuildGradle(configOuter, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      allProjectsRegex,
      `$1\n${additionalMavenRepositoryString}`,
    );
    return config;
  });
};
