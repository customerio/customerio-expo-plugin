import { ConfigPlugin, withAppBuildGradle } from '@expo/config-plugins';

import {
  CIO_APP_APPLY_REGEX,
  CIO_APP_GOOGLE_SNIPPET,
} from '../helpers/constants/android';
import { CustomerIOPluginOptionsAndroid } from '../types/cio-types';

export const withAppGoogleServices: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter) => {
  return withAppBuildGradle(configOuter, (props) => {
    props.modResults.contents = props.modResults.contents.replace(
      CIO_APP_APPLY_REGEX,
      `$1\n${CIO_APP_GOOGLE_SNIPPET}`,
    );
    return props;
  });
};
