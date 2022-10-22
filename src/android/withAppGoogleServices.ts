import { ConfigPlugin, withAppBuildGradle } from '@expo/config-plugins';

import {
  CIO_APP_APPLY_REGEX,
  CIO_APP_GOOGLE_SNIPPET,
} from '../helpers/constants/android';
import { injectCodeByMultiLineRegex } from '../helpers/utils/codeInjection';
import type { CustomerIOPluginOptionsAndroid } from '../types/cio-types';

export const withAppGoogleServices: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter) => {
  return withAppBuildGradle(configOuter, (props) => {
    props.modResults.contents = injectCodeByMultiLineRegex(
      props.modResults.contents,
      CIO_APP_APPLY_REGEX,
      `$1\n${CIO_APP_GOOGLE_SNIPPET}`
    );
    return props;
  });
};
