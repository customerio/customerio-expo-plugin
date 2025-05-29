import { withProjectBuildGradle } from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';

import { FileManagement } from './../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsAndroid } from './../types/cio-types';

export const withGoogleServicesJSON: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter, cioProps) => {
  return withProjectBuildGradle(configOuter, (props) => {
    const options: CustomerIOPluginOptionsAndroid = {
      androidPath: props.modRequest.platformProjectRoot,
      googleServicesFile: cioProps?.googleServicesFile,
    };
    const { androidPath, googleServicesFile } = options;
    if (!FileManagement.exists(`${androidPath}/app/google-services.json`)) {
      if (googleServicesFile && FileManagement.exists(googleServicesFile)) {
        try {
          FileManagement.copyFile(
            googleServicesFile,
            `${androidPath}/app/google-services.json`
          );
        } catch (e) {
          console.log(
            `There was an error copying your google-services.json file. You can copy it manually into ${androidPath}/app/google-services.json`
          );
        }
      } else {
        console.log(
          `The Google Services file provided in ${googleServicesFile} doesn't seem to exist. You can copy it manually into ${androidPath}/app/google-services.json`
        );
      }
    } else {
      console.log(
        `File already exists: ${androidPath}/app/google-services.json. Skipping...`
      );
    }

    return props;
  });
};
