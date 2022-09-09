import { CustomerIOPluginOptionsAndroid } from './../types/cio-types';
import { withProjectBuildGradle, ConfigPlugin } from '@expo/config-plugins';

import {
  CIO_PROJECT_ALLPROJECTS_REGEX,
  CIO_PROJECT_GIST_MAVEN_SNIPPET,
} from '../helpers/constants/android';

export const withGistMavenRepository: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter) => {
  return withProjectBuildGradle(configOuter, (props) => {
    props.modResults.contents = props.modResults.contents.replace(
      CIO_PROJECT_ALLPROJECTS_REGEX,
      `$1\n${CIO_PROJECT_GIST_MAVEN_SNIPPET}`,
    );
    return props;
  });
};
