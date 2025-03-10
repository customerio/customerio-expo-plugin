import {
  withXcodeProject,
  IOSConfig,
  ConfigPlugin,
} from '@expo/config-plugins';

import { FileManagement } from './../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { isFcmPushProvider } from './utils';

export const withGoogleServicesJsonFile: ConfigPlugin<
  CustomerIOPluginOptionsIOS
> = (config, cioProps) => {
  return withXcodeProject(config, async (props) => {
    const useFcm = isFcmPushProvider(cioProps);
    if (!useFcm) {
      // Nothing to do, for providers other than FCM, the Google services JSON file isn't needed
      return props;
    }

    // googleServicesFile
    const iosPath = props.modRequest.platformProjectRoot;
    const googleServicesFile = cioProps.pushNotification?.googleServicesFile;
    const appName = props.modRequest.projectName;

    if (FileManagement.exists(`${iosPath}/GoogleService-Info.plist`)) {
      console.log(
        `File already exists: ${iosPath}/GoogleService-Info.plist. Skipping...`
      );
      return props;
    }

    if (
      FileManagement.exists(`${iosPath}/${appName}/GoogleService-Info.plist`)
    ) {
      // This is where RN Firebase potentially copies GoogleService-Info.plist
      // Do not copy if it's already done by Firebase to avoid conflict in Resources
      console.log(
        `File already exists: ${iosPath}/${appName}/GoogleService-Info.plist. Skipping...`
      );
      return props;
    }

    if (googleServicesFile && FileManagement.exists(googleServicesFile)) {
      try {
        FileManagement.copyFile(
          googleServicesFile,
          `${iosPath}/GoogleService-Info.plist`
        );

        addFileToXcodeProject(props.modResults, 'GoogleService-Info.plist');
      } catch (e) {
        console.error(
          `There was an error copying your GoogleService-Info.plist file. You can copy it manually into ${iosPath}/GoogleService-Info.plist`
        );
      }
    } else {
      console.error(
        `The Google Services file provided in ${googleServicesFile} doesn't seem to exist. You can copy it manually into ${iosPath}/GoogleService-Info.plist`
      );
    }

    return props;
  });
};

function addFileToXcodeProject(project: any, fileName: string) {
  const groupName = 'Resources';
  const filepath = fileName;

  if (!IOSConfig.XcodeUtils.ensureGroupRecursively(project, groupName)) {
    console.error(
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
