import { withProjectBuildGradle, ConfigPlugin } from '@expo/config-plugins';
import { copyFileSync } from 'fs';

import { CustomerIOPluginOptionsAndroid } from './../types/cio-types';

export const withGoogleServicesJSON: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter, cioProps) => {
  return withProjectBuildGradle(configOuter, (props) => {
    const options: CustomerIOPluginOptionsAndroid = {
      androidPath: props.modRequest.platformProjectRoot,
      googleServicesFilePath: cioProps?.googleServicesFilePath,
    };
    const { androidPath, googleServicesFilePath } = options;
    if (googleServicesFilePath) {
      try {
        copyFileSync(
          `${googleServicesFilePath}google-services.json`,
          `${androidPath}/app/google-services.json`,
        );
      } catch (e) {
        console.log(
          'There was an error copying your google-services.json file.',
        );
      }
    }

    return props;
  });
};
