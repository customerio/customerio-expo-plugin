import { ConfigPlugin, withProjectBuildGradle } from '@expo/config-plugins';
import { injectCodeByMultiLineRegex } from '../helpers/utils/codeInjection';

import {
  CIO_PROJECT_BUILDSCRIPTS_REGEX,
  CIO_PROJECT_GOOGLE_SNIPPET,
} from './../helpers/constants/android';
import type { CustomerIOPluginOptionsAndroid } from './../types/cio-types';

export const withProjectGoogleServices: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter) => {
  return withProjectBuildGradle(configOuter, (props) => {
    props.modResults.contents = injectCodeByMultiLineRegex(
      props.modResults.contents,
      CIO_PROJECT_BUILDSCRIPTS_REGEX,
      `$1\n${CIO_PROJECT_GOOGLE_SNIPPET}`
    );
    return props;
  });
};
