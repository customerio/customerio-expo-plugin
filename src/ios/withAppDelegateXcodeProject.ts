import { FileManagement } from './../helpers/utils/fileManagement';
import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import xcode from 'xcode';

import {
  DEFAULT_BUNDLE_VERSION,
  LOCAL_PATH_TO_CIO_NSE_FILES,
} from '../helpers/constants/ios';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';

const addNotificationSwiftFile = async (
  options: CustomerIOPluginOptionsIOS
) => {
  const { iosPath, appName } = options;
  const projPath = `${iosPath}/${appName}.xcodeproj/project.pbxproj`;
  const xcodeProject = xcode.project(projPath);

  xcodeProject.parse(async function (err: Error) {
    const file = 'PushNotification.swift';
    const getTargetFile = (filename: string) =>
      `${iosPath}/${appName}/${filename}`;
    if (err) {
      throw new Error(`Error parsing iOS project: ${JSON.stringify(err)}`);
    }

    if (!FileManagement.exists(getTargetFile(file))) {
      FileManagement.mkdir(`${iosPath}/${appName}`, {
        recursive: true,
      });

      const targetFile = getTargetFile(file);
      FileManagement.copyFile(`${LOCAL_PATH_TO_CIO_NSE_FILES}/${file}`, targetFile);
    } else {
      console.log(`${getTargetFile(file)} already exists. Skipping...`);
    }

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
        'Adding NotificationServiceExtension failed: ios config missing from app.config.js.'
      );

    const { projectName, platformProjectRoot } = modRequest;
    const { bundleIdentifier, buildNumber } = ios;

    if (bundleShortVersion === undefined) {
      throw new Error(
        'Adding NotificationServiceExtension failed: version missing from app.config.js'
      );
    }

    if (bundleIdentifier === undefined) {
      throw new Error(
        'Adding NotificationServiceExtension failed: ios.bundleIdentifier missing from app.config.js'
      );
    }

    if (projectName === undefined) {
      throw new Error(
        'Adding NotificationServiceExtension failed: name missing from app.config.js'
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

    await addNotificationSwiftFile(options);

    return config;
  });
};
