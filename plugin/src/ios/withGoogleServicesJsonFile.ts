import {
  withXcodeProject,
  IOSConfig,
  ConfigPlugin,
} from '@expo/config-plugins';

import { FileManagement } from './../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { isFcmPushProvider } from './utils';

/**
 * Checks if a file is already referenced in the Xcode project
 * 
 * @param project The Xcode project
 * @param fileName The file name to check
 * @returns True if the file is already referenced in the project
 */
function isFileReferencedInXcodeProject(project: any, fileName: string): boolean {
  try {
    // Get all file references
    const fileReferences = project.pbxFileReferenceSection();
    
    // Check if any file reference matches our fileName
    for (const key in fileReferences) {
      const fileReference = fileReferences[key];
      if (typeof fileReference === 'object' && fileReference.name === fileName) {
        return true;
      }
      
      // Some file references might use path instead of name
      if (typeof fileReference === 'object' && fileReference.path === fileName) {
        return true;
      }
    }
    
    // Check in resources build phase as well
    const buildPhases = project.pbxResourcesBuildPhaseSection();
    for (const key in buildPhases) {
      const buildPhase = buildPhases[key];
      
      if (typeof buildPhase === 'object' && buildPhase.files) {
        for (const fileKey of buildPhase.files) {
          const buildFile = project.pbxBuildFileSection()[fileKey.value];
          if (buildFile && buildFile.fileRef) {
            const fileRef = project.pbxFileReferenceSection()[buildFile.fileRef];
            if (fileRef && (fileRef.name === fileName || fileRef.path === fileName)) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  } catch (error) {
    console.warn(`Error checking if ${fileName} is referenced in Xcode project: ${error}`);
    // In case of error, assume it's not referenced to be safe
    return false;
  }
}

/**
 * Adds a file to the Xcode project
 * 
 * @param project The Xcode project
 * @param fileName The file name to add
 * @returns boolean indicating success
 */
function addFileToXcodeProject(project: any, fileName: string): boolean {
  const groupName = 'Resources';
  const filepath = fileName;

  if (!IOSConfig.XcodeUtils.ensureGroupRecursively(project, groupName)) {
    console.error(
      `Error copying GoogleService-Info.plist. Failed to find or create '${groupName}' group in Xcode.`
    );
    return false;
  }

  try {
    // Add GoogleService-Info.plist to the Xcode project
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      project,
      filepath,
      groupName,
      isBuildFile: true,
    });
    return true;
  } catch (error) {
    // Handle potential errors like file already added
    if (String(error).includes('already exists')) {
      console.log(`File ${fileName} is already in the Xcode project. Skipping addition.`);
      return true;
    } else {
      console.error(`Error adding ${fileName} to Xcode project: ${error}`);
      return false;
    }
  }
}

/**
 * Find an existing GoogleService-Info.plist file in common locations
 * 
 * @param iosPath iOS project root path
 * @param appName iOS app name
 * @returns Path to existing file or null if not found
 */
function findExistingGoogleServicesFile(iosPath: string, appName: string): string | null {
  // Define all possible locations where GoogleService-Info.plist might exist
  const possibleLocations = [
    `${iosPath}/GoogleService-Info.plist`,                    // Our plugin's default location
    `${iosPath}/${appName}/GoogleService-Info.plist`          // Where React Native Firebase typically adds it
  ];
  
  for (const location of possibleLocations) {
    if (FileManagement.exists(location)) {
      console.log(`Found existing GoogleService-Info.plist at ${location}`);
      return location;
    }
  }
  
  return null;
}

/**
 * Checks for configuration conflicts between Expo and CustomerIO
 * 
 * @param config Expo config
 * @param googleServicesFile Customer IO googleServicesFile path
 */
function checkConfigConflicts(config: any, googleServicesFile: string | undefined): void {
  if (config.ios?.googleServicesFile && googleServicesFile) {
    console.warn(
      'CONFLICT DETECTED: Specifying both Expo ios.googleServicesFile and Customer IO ios.pushNotification.googleServicesFile' +
      ' will cause a conflict by duplicating GoogleService-Info.plist in the iOS project resources.' +
      '\nRECOMMENDATION: Please remove Customer IO ios.pushNotification.googleServicesFile from your configuration.'
    );
  }
}

/**
 * Copy GoogleService-Info.plist from source to destination and add to Xcode project
 * 
 * @param sourceFile Source file path
 * @param destinationPath Destination path
 * @param project Xcode project
 * @returns boolean indicating success
 */
function copyAndAddGoogleServicesFile(
  sourceFile: string, 
  destinationPath: string, 
  project: any
): boolean {
  try {
    console.log(`Copying GoogleService-Info.plist from ${sourceFile} to ${destinationPath}`);
    FileManagement.copyFile(sourceFile, destinationPath);

    const success = addFileToXcodeProject(project, 'GoogleService-Info.plist');
    if (success) {
      console.log('Successfully added GoogleService-Info.plist to Xcode project');
    }
    return success;
  } catch (e) {
    console.error(
      `ERROR: There was an error copying your GoogleService-Info.plist file: ${e}` +
      `\nYou can copy it manually into ${destinationPath} and add it to your Xcode project`
    );
    return false;
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

    console.log(
      'Only specify Customer IO ios.pushNotification.googleServicesFile config if you are not already including' +
        ' GoogleService-Info.plist as part of Firebase integration'
    );

    const iosPath = props.modRequest.platformProjectRoot;
    const appName = props.modRequest.projectName;
    const googleServicesFile = cioProps.pushNotification?.googleServicesFile;
    const fileName = 'GoogleService-Info.plist';
    const destinationPath = `${iosPath}/${fileName}`;

    // Check if file already exists in common locations
    // We know appName should be defined in the context of an Expo plugin
    const existingFilePath = findExistingGoogleServicesFile(iosPath, appName as string);
    
    if (existingFilePath) {
      console.log(`File already exists: ${existingFilePath}. Skipping copy...`);
      
      // If the file is in the main iOS directory, check if it's in the Xcode project
      if (existingFilePath === destinationPath && !isFileReferencedInXcodeProject(props.modResults, fileName)) {
        console.log('Adding existing GoogleService-Info.plist to Xcode project...');
        addFileToXcodeProject(props.modResults, fileName);
      } else {
        console.log('GoogleService-Info.plist is already referenced or in a location handled by other tools. No action needed.');
      }
      
      return props;
    }

    // Check for config conflicts
    checkConfigConflicts(config, googleServicesFile);

    // Only copy if the file wasn't found anywhere and a source file was provided
    if (googleServicesFile && FileManagement.exists(googleServicesFile)) {
      copyAndAddGoogleServicesFile(googleServicesFile, destinationPath, props.modResults);
    } else if (googleServicesFile) {
      console.error(
        `ERROR: The Google Services file specified at "${googleServicesFile}" does not exist.` +
        `\nPlease check the path and make sure the file exists, or copy it manually into ${destinationPath}`
      );
    } else {
      console.warn(
        `WARNING: No GoogleService-Info.plist source file was provided in the configuration.` +
        `\nIf you're using FCM for push notifications, you need to provide the file.` +
        `\nPlease add it manually to ${destinationPath} or configure it through Customer IO ios.pushNotification.googleServicesFile`
      );
    }

    return props;
  });
};