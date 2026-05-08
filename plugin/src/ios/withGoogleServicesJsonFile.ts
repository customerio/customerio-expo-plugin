import type { ConfigPlugin, XcodeProject } from '@expo/config-plugins';
import { IOSConfig, withXcodeProject } from '@expo/config-plugins';

import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { logger } from '../utils/logger';
import { FileManagement } from './../helpers/utils/fileManagement';
import { isFcmPushProvider } from './utils';

export type CopyGoogleServicePlistOptions = {
  iosPath: string;
  appName: string | undefined;
  googleServicesFile: string | undefined;
  expoIosGoogleServicesFileSet: boolean;
  xcodeProject: XcodeProject;
};

/**
 * Copies the FCM GoogleService-Info.plist into the iOS project (when needed) and registers it
 * in the Xcode project's Resources group. Idempotent — no-ops if a plist is already present
 * at either of the two well-known locations Expo / RN Firebase use.
 */
export function copyGoogleServicePlistFile({
  iosPath,
  appName,
  googleServicesFile,
  expoIosGoogleServicesFileSet,
  xcodeProject,
}: CopyGoogleServicePlistOptions): void {
  const destination = `${iosPath}/GoogleService-Info.plist`;

  if (FileManagement.exists(destination)) {
    logger.info(`File already exists: ${destination}. Skipping...`);
    return;
  }

  if (appName && FileManagement.exists(`${iosPath}/${appName}/GoogleService-Info.plist`)) {
    // This is where RN Firebase potentially copies GoogleService-Info.plist
    // Do not copy if it's already done by Firebase to avoid conflict in Resources
    logger.info(
      `File already exists: ${iosPath}/${appName}/GoogleService-Info.plist. Skipping...`
    );
    return;
  }

  if (googleServicesFile && FileManagement.exists(googleServicesFile)) {
    if (expoIosGoogleServicesFileSet) {
      logger.warn(
        'Specifying both Expo ios.googleServicesFile and Customer.io ios.pushNotification.googleServicesFile can cause a conflict' +
        ' duplicating GoogleService-Info.plist in the iOS project resources. Please remove Customer.io ios.pushNotification.googleServicesFile'
      );
    }

    try {
      FileManagement.copyFile(googleServicesFile, destination);
      addFileToXcodeProject(xcodeProject, 'GoogleService-Info.plist');
    } catch {
      logger.error(
        `There was an error copying your GoogleService-Info.plist file. You can copy it manually into ${destination}`
      );
    }
  } else {
    logger.error(
      `The Google Services file provided in ${googleServicesFile} doesn't seem to exist. You can copy it manually into ${destination}`
    );
  }
}

export const withGoogleServicesJsonFile: ConfigPlugin<
  CustomerIOPluginOptionsIOS
> = (config, cioProps) => {
  return withXcodeProject(config, async (props) => {
    const useFcm = isFcmPushProvider(cioProps);
    if (!useFcm) {
      // Nothing to do, for providers other than FCM, the Google services JSON file isn't needed
      return props;
    }

    logger.info(
      'Only specify Customer.io ios.pushNotification.googleServicesFile config if you are not already including' +
      ' GoogleService-Info.plist as part of Firebase integration'
    );

    copyGoogleServicePlistFile({
      iosPath: props.modRequest.platformProjectRoot,
      appName: props.modRequest.projectName,
      googleServicesFile: cioProps.pushNotification?.googleServicesFile,
      expoIosGoogleServicesFileSet: Boolean(config.ios?.googleServicesFile),
      xcodeProject: props.modResults,
    });

    return props;
  });
};

function addFileToXcodeProject(project: XcodeProject, fileName: string) {
  const groupName = 'Resources';
  const filepath = fileName;

  if (!IOSConfig.XcodeUtils.ensureGroupRecursively(project, groupName)) {
    logger.error(
      `Error copying GoogleService-Info.plist. Failed to find or create '${groupName}' group in Xcode.`
    );
    return;
  }

  // Add GoogleService-Info.plist to the Xcode project
  IOSConfig.XcodeUtils.addResourceFileToGroup({
    project,
    filepath,
    groupName,
    isBuildFile: true,
  });
}
