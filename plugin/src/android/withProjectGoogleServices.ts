import type { ConfigPlugin } from '@expo/config-plugins';
import { withProjectBuildGradle } from '@expo/config-plugins';

import {
  CIO_PROJECT_BUILDSCRIPTS_REGEX,
  CIO_PROJECT_GOOGLE_SNIPPET,
} from './../helpers/constants/android';
import type { CustomerIOPluginOptionsAndroid } from './../types/cio-types';

export function modifyProjectBuildGradleForGoogleServices(contents: string): string {
  const regex = new RegExp(CIO_PROJECT_GOOGLE_SNIPPET);
  if (regex.test(contents)) {
    return contents;
  }
  return contents.replace(
    CIO_PROJECT_BUILDSCRIPTS_REGEX,
    `$1\n${CIO_PROJECT_GOOGLE_SNIPPET}`
  );
}

export const withProjectGoogleServices: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter) => {
  return withProjectBuildGradle(configOuter, (props) => {
    props.modResults.contents = modifyProjectBuildGradleForGoogleServices(
      props.modResults.contents
    );
    return props;
  });
};
