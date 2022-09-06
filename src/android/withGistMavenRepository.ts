import { withProjectBuildGradle, ConfigPlugin } from '@expo/config-plugins';

import {
  CIO_PROJECT_ALLPROJECTS_REGEX,
  CIO_PROJECT_GIST_MAVEN_SNIPPET,
} from '../helpers/constants/android';
import { CustomerIOPluginOptions } from '../types/cio-types';

export const withGistMavenRepository: ConfigPlugin<CustomerIOPluginOptions> = (
  configOuter,
) => {
  return withProjectBuildGradle(configOuter, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      CIO_PROJECT_ALLPROJECTS_REGEX,
      `$1\n${CIO_PROJECT_GIST_MAVEN_SNIPPET}`,
    );
    return config;
  });
};
