import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import { mkdirSync, copyFileSync, writeFileSync } from 'fs';
import xcode from 'xcode';

import {
  CIO_TARGET_NAME,
  IOS_DEPLOYMENT_TARGET,
} from '../helpers/constants/ios';
import { injectCIOPodfileCode } from '../helpers/utils/injectCIOPodfileCode';
import { CustomerIOPluginOptions } from '../types/cio-types';

export const withCioXcodeProject: ConfigPlugin<CustomerIOPluginOptions> = (
  config,
  cioProps,
) => {
  return withXcodeProject(config, async (props) => {
    const options: CustomerIOPluginOptions = {
      iosPath: props.modRequest.platformProjectRoot,
      bundleIdentifier: props.ios?.bundleIdentifier,
      devTeam: cioProps?.devTeam,
      bundleVersion: props.ios?.buildNumber,
      bundleShortVersion: props?.version,
      mode: cioProps?.mode,
      iosDeploymentTarget: cioProps?.iosDeploymentTarget,
    };

    const appName = props.modRequest.projectName || '';
    const sourceDir = 'node_modules/cio-expo-plugin/build/helpers/ios/';
    const { iosPath, devTeam, iosDeploymentTarget } = options;

    await injectCIOPodfileCode(iosPath);

    const projPath = `${iosPath}/${appName}.xcodeproj/project.pbxproj`;

    const extFiles = [
      'CustomerioReactnative.m',
      'CustomerioReactnative-Bridging-Header.h',
      'CustomerioReactnative.swift',
      'CustomerioUtils.swift',
    ];

    const xcodeProject = xcode.project(projPath);

    xcodeProject.parse(async function (err: Error) {
      if (err) {
        throw new Error(`Error parsing iOS project: ${JSON.stringify(err)}`);
      }

      mkdirSync(`${iosPath}/${CIO_TARGET_NAME}`, { recursive: true });

      for (let i = 0; i < extFiles.length; i++) {
        const extFile = extFiles[i];
        const targetFile = `${iosPath}/${CIO_TARGET_NAME}/${extFile}`;
        copyFileSync(`${sourceDir}${extFile}`, targetFile);
      }

      // Edit the Deployment info for CIO SDK
      const configurations = xcodeProject.pbxXCBuildConfigurationSection();
      for (const key in configurations) {
        if (
          typeof configurations[key].buildSettings !== 'undefined' &&
          configurations[key].buildSettings.PRODUCT_NAME ===
            `"${CIO_TARGET_NAME}"`
        ) {
          const buildSettingsObj = configurations[key].buildSettings;
          buildSettingsObj.DEVELOPMENT_TEAM = devTeam;
          buildSettingsObj.IPHONEOS_DEPLOYMENT_TARGET =
            iosDeploymentTarget ?? IOS_DEPLOYMENT_TARGET;
        }
      }

      writeFileSync(projPath, xcodeProject.writeSync());
    });

    return props;
  });
};
