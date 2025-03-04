import { withXcodeProject, IOSConfig, ConfigPlugin } from '@expo/config-plugins';

import { FileManagement } from './../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';

export const withGoogleServicesJsonFile: ConfigPlugin<CustomerIOPluginOptionsIOS> = (
  config,
  cioProps
) => {
  return withXcodeProject(config, async (props) => {
    
    const pushProvider = cioProps.pushNotification?.provider ?? 'apn';
    const useFcm = pushProvider === 'fcm';
    if (!useFcm) {
        // Nothing to do, for providers other than FCM, the Google services JSON file isn't needed
        return props;
    }

    // googleServicesFile
    const iosPath = props.modRequest.platformProjectRoot;
    const googleServicesFile = cioProps.pushNotification?.googleServicesFile;
    if (!FileManagement.exists(`${iosPath}/GoogleService-Info.plist`)) {
          if (googleServicesFile && FileManagement.exists(googleServicesFile)) {
            try {
              FileManagement.copyFile(
                googleServicesFile,
                `${iosPath}/GoogleService-Info.plist`
              );

              addFileToXcodeProject(props.modResults, "GoogleService-Info.plist");
            } catch (e) {
              console.error(
                `There was an error copying your google-services.json file. You can copy it manually into ${iosPath}/google-services.json`
              );
            }
          } else {
            console.error(
              `The Google Services file provided in ${googleServicesFile} doesn't seem to exist. You can copy it manually into ${iosPath}/google-services.json`
            );
          }
        } else {
          console.log(
            `File already exists: ${iosPath}/google-services.json. Skipping...`
          );
        }
    

    return props;
  });
};

function addFileToXcodeProject(project: any, fileName: string) {
    const groupName = "Resources";
    const filepath = fileName;
  
    if (!IOSConfig.XcodeUtils.ensureGroupRecursively(project, groupName)) {
      console.error(`Error copying GoogleService-Info.plist. Failed to find or create '${groupName}' group in Xcode.`);
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