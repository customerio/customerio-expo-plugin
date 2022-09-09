import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import { mkdirSync, copyFileSync, writeFileSync } from 'fs';
import xcode from 'xcode';

import {
  BUNDLE_SHORT_VERSION_TEMPLATE_REGEX,
  BUNDLE_VERSION_TEMPLATE_REGEX,
  CIO_NOTIFICATION_TARGET_NAME,
  DEFAULT_BUNDLE_SHORT_VERSION,
  DEFAULT_BUNDLE_VERSION,
  IOS_DEPLOYMENT_TARGET,
} from '../helpers/constants/ios';
import { FileManagement } from '../helpers/utils/fileManagement';
import { injectCIONotificationPodfileCode } from '../helpers/utils/injectCIOPodfileCode';
import { CustomerIOPluginOptionsIOS } from '../types/cio-types';

const plistFileName = `${CIO_NOTIFICATION_TARGET_NAME}-Info.plist`;

export const withCioNotificationsXcodeProject: ConfigPlugin<
  CustomerIOPluginOptionsIOS
> = (config, cioProps) => {
  return withXcodeProject(config, async (props) => {
    const options: CustomerIOPluginOptionsIOS = {
      iosPath: props.modRequest.platformProjectRoot,
      bundleIdentifier: `${props.ios?.bundleIdentifier}`,
      devTeam: cioProps?.devTeam,
      bundleVersion: props.ios?.buildNumber,
      bundleShortVersion: props?.version,
      mode: cioProps?.mode,
      iosDeploymentTarget: cioProps?.iosDeploymentTarget,
    };

    const appName = props.modRequest.projectName || '';
    const sourceDir = 'plugin/helpers/ios/';
    const {
      iosPath,
      iosDeploymentTarget,
      bundleIdentifier,
      bundleVersion,
      bundleShortVersion,
    } = options;

    const projPath = `${iosPath}/${appName}.xcodeproj/project.pbxproj`;

    const xcodeProject = xcode.project(projPath);
    const extFiles = ['CIONotificationService.swift', plistFileName];

    await injectCIONotificationPodfileCode(iosPath);

    xcodeProject.parse(async function (err: Error) {
      if (err) {
        throw new Error(`Error parsing iOS project: ${JSON.stringify(err)}`);
      }

      copyNativeFiles(extFiles, iosPath, sourceDir);

      await modifyCopiedFiles(
        iosPath,
        bundleVersion as string,
        bundleShortVersion as string,
      );

      // Create new PBXGroup for the new extension
      setupPBXGroup(xcodeProject, extFiles);

      if (xcodeProject.pbxTargetByName(CIO_NOTIFICATION_TARGET_NAME)) {
        return;
      }

      // Add the IO target
      // This adds PBXTargetDependency and PBXContainerItemProxy for you
      const target = xcodeProject.addTarget(
        CIO_NOTIFICATION_TARGET_NAME,
        'app_extension',
        CIO_NOTIFICATION_TARGET_NAME,
        `${bundleIdentifier}.${CIO_NOTIFICATION_TARGET_NAME}`,
      );

      // Add build phases to the new target
      addBuildPhases(xcodeProject, target);

      // Edit the Deployment info for CIO SDK
      editDeploymentInfo(
        xcodeProject,
        iosDeploymentTarget ?? IOS_DEPLOYMENT_TARGET,
      );

      writeFileSync(projPath, xcodeProject.writeSync());
    });

    return props;
  });
};

function addBuildPhases(xcodeProject: any, target: any) {
  xcodeProject.addBuildPhase(
    [],
    'PBXSourcesBuildPhase',
    'Sources',
    target.uuid,
  );
  xcodeProject.addBuildPhase(
    [],
    'PBXResourcesBuildPhase',
    'Resources',
    target.uuid,
  );

  xcodeProject.addBuildPhase(
    [],
    'PBXFrameworksBuildPhase',
    'Frameworks',
    target.uuid,
  );
}

function setupPBXGroup(xcodeProject: any, extFiles: string[]) {
  const extGroup = xcodeProject.addPbxGroup(
    extFiles,
    CIO_NOTIFICATION_TARGET_NAME,
    CIO_NOTIFICATION_TARGET_NAME,
  );

  // Add the new PBXGroup to the top level group. This makes the
  // files / folder appear in the file explorer in Xcode.
  const groups = xcodeProject.hash.project.objects['PBXGroup'];
  Object.keys(groups).forEach(function (key) {
    if (groups[key].name === undefined) {
      xcodeProject.addToPbxGroup(extGroup.uuid, key);
    }
  });

  // WORK AROUND for codeProject.addTarget BUG
  // Xcode projects don't contain these if there is only one target
  // An upstream fix should be made to the code referenced in this link:
  //   - https://github.com/apache/cordova-node-xcode/blob/8b98cabc5978359db88dc9ff2d4c015cba40f150/lib/pbxProject.js#L860
  const projObjects = xcodeProject.hash.project.objects;
  projObjects['PBXTargetDependency'] = projObjects['PBXTargetDependency'] || {};
  projObjects['PBXContainerItemProxy'] =
    projObjects['PBXTargetDependency'] || {};
}

async function modifyCopiedFiles(
  iosPath: string,
  bundleVersion: string,
  bundleShortVersion: string,
) {
  await updateBundleVersion(
    bundleVersion ?? DEFAULT_BUNDLE_VERSION,
    `${iosPath}/${CIO_NOTIFICATION_TARGET_NAME}`,
  );
  await updateBundleShortVersion(
    bundleShortVersion ?? DEFAULT_BUNDLE_SHORT_VERSION,
    `${iosPath}/${CIO_NOTIFICATION_TARGET_NAME}`,
  );
}

function copyNativeFiles(
  extFiles: string[],
  iosPath: string,
  sourceDir: string,
) {
  mkdirSync(`${iosPath}/${CIO_NOTIFICATION_TARGET_NAME}`, { recursive: true });

  for (let i = 0; i < extFiles.length; i++) {
    const extFile = extFiles[i];
    const targetFile = `${iosPath}/${CIO_NOTIFICATION_TARGET_NAME}/${extFile}`;
    copyFileSync(`${sourceDir}${extFile}`, targetFile);
  }
}

function editDeploymentInfo(xcodeProject: any, iosDeploymentTarget: string) {
  const configurations = xcodeProject.pbxXCBuildConfigurationSection();
  for (const key in configurations) {
    if (
      typeof configurations[key].buildSettings !== 'undefined' &&
      configurations[key].buildSettings.PRODUCT_NAME ===
        `"${CIO_NOTIFICATION_TARGET_NAME}"`
    ) {
      const buildSettingsObj = configurations[key].buildSettings;
      buildSettingsObj.IPHONEOS_DEPLOYMENT_TARGET =
        iosDeploymentTarget ?? IOS_DEPLOYMENT_TARGET;
    }
  }
}

async function updateBundleVersion(
  version: string,
  path: string,
): Promise<void> {
  const plistFilePath = `${path}/${plistFileName}`;
  let plistFile = await FileManagement.read(plistFilePath);
  plistFile = plistFile.replace(BUNDLE_VERSION_TEMPLATE_REGEX, version);
  await FileManagement.write(plistFilePath, plistFile);
}

async function updateBundleShortVersion(
  version: string,
  path: string,
): Promise<void> {
  const plistFilePath = `${path}/${plistFileName}`;
  let plistFile = await FileManagement.read(plistFilePath);
  plistFile = plistFile.replace(BUNDLE_SHORT_VERSION_TEMPLATE_REGEX, version);
  await FileManagement.write(plistFilePath, plistFile);
}
