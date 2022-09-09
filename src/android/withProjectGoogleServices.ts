import { ConfigPlugin, withProjectBuildGradle } from '@expo/config-plugins';

import {
  CIO_PROJECT_BUILDSCRIPTS_REGEX,
  CIO_PROJECT_GOOGLE_SNIPPET,
} from './../helpers/constants/android';
import { CustomerIOPluginOptionsAndroid } from './../types/cio-types';

export const withProjectGoogleServices: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter) => {
  return withProjectBuildGradle(configOuter, (props) => {
    props.modResults.contents = props.modResults.contents.replace(
      CIO_PROJECT_BUILDSCRIPTS_REGEX,
      `$1\n${CIO_PROJECT_GOOGLE_SNIPPET}`,
    );
    return props;
  });
};
