import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import fs from 'fs';
import xcode from 'xcode';

// import { name as thisPackageName } from '../../package.json';
import { DEFAULT_BUNDLE_VERSION } from '../helpers/constants/ios';
import { injectCIONotificationPodfileCode } from '../helpers/utils/injectCIOPodfileCode';
import { CustomerIOPluginOptionsIOS } from '../types/cio-types';

// const LOCAL_PATH_TO_NSE_FILES = `node_modules/${thisPackageName}/build/${appName}`;

const addNotificationServiceExtensionFile = async (
  options: CustomerIOPluginOptionsIOS,
) => {
  const { iosPath, appName } = options;

  const projPath = `${iosPath}/${appName}.xcodeproj/project.pbxproj`;

  const xcodeProject = xcode.project(projPath);

  xcodeProject.parse(async function (err: Error) {
    if (err) {
      throw new Error(`Error parsing iOS project: ${JSON.stringify(err)}`);
    }

    fs.mkdirSync(`${iosPath}/${appName}`, {
      recursive: true,
    });

    const file = 'PushNotification.swift';

    const getTargetFile = (filename: string) =>
      `${iosPath}/${appName}/${filename}`;
    const sourceDir = 'plugin/helpers/ios';

    const targetFile = getTargetFile(file);
    fs.copyFileSync(`${sourceDir}/${file}`, targetFile);

    // Create new PBXGroup for the extension
    const extGroup = xcodeProject.addPbxGroup([file], appName, appName);

    // Add the new PBXGroup to the top level group. This makes the
    // files / folder appear in the file explorer in Xcode.
    const groups = xcodeProject.hash.project.objects['PBXGroup'];
    Object.keys(groups).forEach((key) => {
      if (groups[key].name === undefined) {
        xcodeProject.addToPbxGroup(extGroup.uuid, key);
      }
    });

    // WORK AROUND for codeProject.addTarget BUG
    // Xcode projects don't contain these if there is only one target
    // An upstream fix should be made to the code referenced in this link:
    //   - https://github.com/apache/cordova-node-xcode/blob/8b98cabc5978359db88dc9ff2d4c015cba40f150/lib/pbxProject.js#L860
    const projObjects = xcodeProject.hash.project.objects;
    projObjects['PBXTargetDependency'] =
      projObjects['PBXTargetDependency'] || {};
    projObjects['PBXContainerItemProxy'] =
      projObjects['PBXTargetDependency'] || {};

    fs.writeFileSync(projPath, xcodeProject.writeSync());
  });
};

export const withCioAppdelegateXcodeProject: ConfigPlugin<
  CustomerIOPluginOptionsIOS
> = (configOuter, props) => {
  return withXcodeProject(configOuter, async (config) => {
    const { modRequest, ios, version: bundleShortVersion } = config;
    const { appleTeamId, iosDeploymentTarget } = props;

    if (ios === undefined)
      throw new Error(
        'Adding NotificationServiceExtension failed: ios config missing from app.config.js.',
      );

    const { projectName, platformProjectRoot } = modRequest;
    const { bundleIdentifier, buildNumber } = ios;

    if (bundleShortVersion === undefined) {
      throw new Error(
        'Adding NotificationServiceExtension failed: version missing from app.config.js',
      );
    }

    if (bundleIdentifier === undefined) {
      throw new Error(
        'Adding NotificationServiceExtension failed: ios.bundleIdentifier missing from app.config.js',
      );
    }

    if (projectName === undefined) {
      throw new Error(
        'Adding NotificationServiceExtension failed: name missing from app.config.js',
      );
    }

    const options = {
      appleTeamId,
      bundleIdentifier,
      bundleShortVersion,
      bundleVersion: buildNumber ?? DEFAULT_BUNDLE_VERSION,
      iosPath: platformProjectRoot,
      appName: projectName,
      iosDeploymentTarget,
    };

    await addNotificationServiceExtensionFile(options);

    return config;
  });
};
