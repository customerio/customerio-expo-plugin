import { ConfigPlugin, withAppBuildGradle } from '@expo/config-plugins';

import {
  CIO_APP_APPLY_REGEX,
  CIO_APP_GOOGLE_SNIPPET,
} from '../helpers/constants/android';
import { CustomerIOPluginOptions } from '../types/cio-types';

export const withAppGoogleServices: ConfigPlugin<CustomerIOPluginOptions> = (
  configOuter,
) => {
  return withAppBuildGradle(configOuter, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      CIO_APP_APPLY_REGEX,
      `$1\n${CIO_APP_GOOGLE_SNIPPET}`,
    );
    return config;
  });
};
