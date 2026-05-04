import type { ConfigPlugin } from '@expo/config-plugins';
import { withProjectBuildGradle } from '@expo/config-plugins';

import { logger } from '../utils/logger';
import { FileManagement } from './../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsAndroid } from './../types/cio-types';

export function copyGoogleServicesFile(
  androidPath: string,
  googleServicesFile: string | undefined
): void {
  const destination = `${androidPath}/app/google-services.json`;

  if (FileManagement.exists(destination)) {
    logger.info(`File already exists: ${destination}. Skipping...`);
    return;
  }

  if (googleServicesFile && FileManagement.exists(googleServicesFile)) {
    try {
      FileManagement.copyFile(googleServicesFile, destination);
    } catch {
      logger.info(
        `There was an error copying your google-services.json file. You can copy it manually into ${destination}`
      );
    }
  } else {
    logger.info(
      `The Google Services file provided in ${googleServicesFile} doesn't seem to exist. You can copy it manually into ${destination}`
    );
  }
}

export const withGoogleServicesJSON: ConfigPlugin<
  CustomerIOPluginOptionsAndroid
> = (configOuter, cioProps) => {
  return withProjectBuildGradle(configOuter, (props) => {
    copyGoogleServicesFile(
      props.modRequest.platformProjectRoot,
      cioProps?.googleServicesFile
    );
    return props;
  });
};
