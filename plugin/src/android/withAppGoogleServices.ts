import type { ConfigPlugin } from '@expo/config-plugins';
import { withAppBuildGradle } from '@expo/config-plugins';

import {
  CIO_APP_APPLY_REGEX,
  CIO_APP_GOOGLE_SNIPPET,
} from '../helpers/constants/android';
import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';
import { logger } from '../utils/logger';

export function modifyAppBuildGradle(contents: string): string {
  const regex = new RegExp(CIO_APP_GOOGLE_SNIPPET);
  if (regex.test(contents)) {
    logger.info('app/build.gradle snippet already exists. Skipping...');
    return contents;
  }
  return contents.replace(
    CIO_APP_APPLY_REGEX,
    `$1\n${CIO_APP_GOOGLE_SNIPPET}`
  );
}

export const withAppGoogleServices: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter) => {
  return withAppBuildGradle(configOuter, (props) => {
    props.modResults.contents = modifyAppBuildGradle(props.modResults.contents);
    return props;
  });
};
