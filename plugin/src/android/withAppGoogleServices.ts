import { ConfigPlugin, withAppBuildGradle } from '@expo/config-plugins';

import {
  CIO_APP_APPLY_REGEX,
  CIO_APP_GOOGLE_SNIPPET,
} from '../helpers/constants/android';
import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';

export const withAppGoogleServices: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter) => {
  return withAppBuildGradle(configOuter, (props) => {
    const regex = new RegExp(CIO_APP_GOOGLE_SNIPPET);
    const match = props.modResults.contents.match(regex);
    if (!match) {
      props.modResults.contents = props.modResults.contents.replace(
        CIO_APP_APPLY_REGEX,
        `$1\n${CIO_APP_GOOGLE_SNIPPET}`
      );
    } else {
      console.log('app/build.gradle snippet already exists. Skipping...');
    }

    return props;
  });
};
