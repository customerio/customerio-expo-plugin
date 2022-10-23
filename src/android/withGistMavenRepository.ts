import { withProjectBuildGradle, ConfigPlugin } from '@expo/config-plugins';

import {
  CIO_GIST_MAVEN_REGEX,
  CIO_PROJECT_ALLPROJECTS_REGEX,
  CIO_PROJECT_GIST_MAVEN_SNIPPET,
} from '../helpers/constants/android';
import type { CustomerIOPluginOptionsAndroid } from './../types/cio-types';

export const withGistMavenRepository: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter) => {
  return withProjectBuildGradle(configOuter, (props) => {
    const targetMatch = props.modResults.contents.match(CIO_GIST_MAVEN_REGEX);
    if (!targetMatch) {
      props.modResults.contents = props.modResults.contents.replace(
        CIO_PROJECT_ALLPROJECTS_REGEX,
        `$1\n${CIO_PROJECT_GIST_MAVEN_SNIPPET}`
      );
    } else {
      console.log('build.gradle snippet alreade exists. Skipping...');
    }

    return props;
  });
};
