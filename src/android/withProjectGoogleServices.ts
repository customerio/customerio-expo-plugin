import { ConfigPlugin, withProjectBuildGradle } from '@expo/config-plugins';

import { CustomerIOPluginOptions } from '../types/cio-types';
import {
  CIO_PROJECT_BUILDSCRIPTS_REGEX,
  CIO_PROJECT_GOOGLE_SNIPPET,
} from './../helpers/constants/android';

export const withProjectGoogleServices: ConfigPlugin<
  CustomerIOPluginOptions
> = (configOuter) => {
  return withProjectBuildGradle(configOuter, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      CIO_PROJECT_BUILDSCRIPTS_REGEX,
      `$1\n${CIO_PROJECT_GOOGLE_SNIPPET}`,
    );
    return config;
  });
};
