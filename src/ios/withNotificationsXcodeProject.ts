import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';

import {
  CIO_NOTIFICATION_TARGET_NAME,
  CIO_REGISTER_PUSHNOTIFICATION_SNIPPET,
  DEFAULT_BUNDLE_VERSION,
  LOCAL_PATH_TO_CIO_NSE_FILES,
} from '../helpers/constants/ios';
import { replaceCodeByRegex } from '../helpers/utils/codeInjection';
import { injectCIONotificationPodfileCode } from '../helpers/utils/injectCIOPodfileCode';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { FileManagement } from './../helpers/utils/fileManagement';

const PLIST_FILENAME = `${CIO_NOTIFICATION_TARGET_NAME}-Info.plist`;
const ENV_FILENAME = 'Env.swift';

const TARGETED_DEVICE_FAMILY = `"1,2"`;

const addNotificationServiceExtension = async (
  options: CustomerIOPluginOptionsIOS,
  xcodeProject: any
) => {
  if (options.pushNotification) {
    await addPushNotificationFile(options, xcodeProject);
  }

  if (options.pushNotification?.useRichPush) {
    await addRichPushXcodeProj(options, xcodeProject);
  }
};

export const withCioNotificationsXcodeProject: ConfigPlugin<
  CustomerIOPluginOptionsIOS
> = (configOuter, props) => {
  return withXcodeProject(configOuter, async (config) => {
    const { modRequest, ios, version: bundleShortVersion } = config;
    const {
      appleTeamId,
      iosDeploymentTarget,
      pushNotification,
      useFrameworks,
    } = props;

    if (ios === undefined)
      throw new Error(
        'Adding NotificationServiceExtension failed: ios config missing from app.config.js or app.json.'
      );

    // projectName and platformProjectRoot translates to appName and iosPath in addNotificationServiceExtension()
    const { projectName, platformProjectRoot } = modRequest;
    const { bundleIdentifier, buildNumber } = ios;

    if (bundleShortVersion === undefined) {
      throw new Error(
        'Adding NotificationServiceExtension failed: version missing from app.config.js or app.json'
      );
    }

    if (bundleIdentifier === undefined) {
      throw new Error(
        'Adding NotificationServiceExtension failed: ios.bundleIdentifier missing from app.config.js or app.json'
      );
    }

    if (projectName === undefined) {
      throw new Error(
        'Adding NotificationServiceExtension failed: name missing from app.config.js or app.json'
      );
    }

    const options = {
      ...props,
      appleTeamId,
      bundleIdentifier,
      bundleShortVersion,
      bundleVersion: buildNumber || DEFAULT_BUNDLE_VERSION,
      iosPath: platformProjectRoot,
      appName: projectName,
      useFrameworks,
      iosDeploymentTarget,
      pushNotification,
    };

    await addNotificationServiceExtension(options, config.modResults);

    return config;
  });
};

const addRichPushXcodeProj = async (
  options: CustomerIOPluginOptionsIOS,
  xcodeProject: any
) => {
  const {
    appleTeamId,
    bundleIdentifier,
    bundleShortVersion,
    bundleVersion,
    iosPath,
    iosDeploymentTarget,
    useFrameworks,
  } = options;

  await injectCIONotificationPodfileCode(iosPath, useFrameworks);

  // Check if `CIO_NOTIFICATION_TARGET_NAME` group already exist in the project
  // If true then skip creating a new group to avoid duplicate folders
  if (xcodeProject.pbxTargetByName(CIO_NOTIFICATION_TARGET_NAME)) {
    console.warn(
      `${CIO_NOTIFICATION_TARGET_NAME} already exists in project. Skipping...`
    );
    return;
  }

  const nsePath = `${iosPath}/${CIO_NOTIFICATION_TARGET_NAME}`;
  FileManagement.mkdir(nsePath, {
    recursive: true,
  });

  const files = [
    PLIST_FILENAME,
    'NotificationService.h',
    'NotificationService.swift',
    'NotificationService.m',
    ENV_FILENAME,
  ];

  const getTargetFile = (filename: string) => `${nsePath}/${filename}`;

  files.forEach((filename) => {
    const targetFile = getTargetFile(filename);
    FileManagement.copyFile(
      `${LOCAL_PATH_TO_CIO_NSE_FILES}/${filename}`,
      targetFile
    );
  });

  /* MODIFY COPIED EXTENSION FILES */
  const infoPlistTargetFile = getTargetFile(PLIST_FILENAME);
  updateNseInfoPlist({
    bundleVersion,
    bundleShortVersion,
    infoPlistTargetFile,
  });
  updateNseEnv(options, getTargetFile(ENV_FILENAME));

  // Create new PBXGroup for the extension
  const extGroup = xcodeProject.addPbxGroup(
    files,
    CIO_NOTIFICATION_TARGET_NAME,
    CIO_NOTIFICATION_TARGET_NAME
  );

  // Add the new PBXGroup to the top level group. This makes the
  // files / folder appear in the file explorer in Xcode.
  const groups = xcodeProject.hash.project.objects['PBXGroup'];
  Object.keys(groups).forEach((key) => {
    if (groups[key].name === undefined && groups[key].path === undefined) {
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

  if (xcodeProject.pbxTargetByName(CIO_NOTIFICATION_TARGET_NAME)) {
    console.warn(
      `${CIO_NOTIFICATION_TARGET_NAME} already exists in project. Skipping...`
    );
    return;
  }

  // Add the NSE target
  // This also adds PBXTargetDependency and PBXContainerItemProxy
  const nseTarget = xcodeProject.addTarget(
    CIO_NOTIFICATION_TARGET_NAME,
    'app_extension',
    CIO_NOTIFICATION_TARGET_NAME,
    `${bundleIdentifier}.richpush`
  );

  // Add build phases to the new target
  xcodeProject.addBuildPhase(
    ['NotificationService.m', 'NotificationService.swift', 'Env.swift'],
    'PBXSourcesBuildPhase',
    'Sources',
    nseTarget.uuid
  );
  xcodeProject.addBuildPhase(
    [],
    'PBXResourcesBuildPhase',
    'Resources',
    nseTarget.uuid
  );

  xcodeProject.addBuildPhase(
    [],
    'PBXFrameworksBuildPhase',
    'Frameworks',
    nseTarget.uuid
  );

  // Edit the Deployment info of the target
  const configurations = xcodeProject.pbxXCBuildConfigurationSection();
  for (const key in configurations) {
    if (
      typeof configurations[key].buildSettings !== 'undefined' &&
      configurations[key].buildSettings.PRODUCT_NAME ===
        `"${CIO_NOTIFICATION_TARGET_NAME}"`
    ) {
      const buildSettingsObj = configurations[key].buildSettings;
      buildSettingsObj.DEVELOPMENT_TEAM = appleTeamId;
      buildSettingsObj.IPHONEOS_DEPLOYMENT_TARGET =
        iosDeploymentTarget || '13.0';
      buildSettingsObj.TARGETED_DEVICE_FAMILY = TARGETED_DEVICE_FAMILY;
      buildSettingsObj.CODE_SIGN_STYLE = 'Automatic';
      buildSettingsObj.SWIFT_VERSION = 4.2;
    }
  }

  // Add development team to the target & the main
  xcodeProject.addTargetAttribute('DevelopmentTeam', appleTeamId, nseTarget);
  xcodeProject.addTargetAttribute('DevelopmentTeam', appleTeamId);
};

const updateNseInfoPlist = (payload: {
  bundleVersion?: string;
  bundleShortVersion?: string;
  infoPlistTargetFile: string;
}) => {
  const BUNDLE_SHORT_VERSION_RE = /\{\{BUNDLE_SHORT_VERSION\}\}/;
  const BUNDLE_VERSION_RE = /\{\{BUNDLE_VERSION\}\}/;

  let plistFileString = FileManagement.readFile(payload.infoPlistTargetFile);

  if (payload.bundleVersion) {
    plistFileString = replaceCodeByRegex(
      plistFileString,
      BUNDLE_VERSION_RE,
      payload.bundleVersion
    );
  }

  if (payload.bundleShortVersion) {
    plistFileString = replaceCodeByRegex(
      plistFileString,
      BUNDLE_SHORT_VERSION_RE,
      payload.bundleShortVersion
    );
  }

  FileManagement.writeFile(payload.infoPlistTargetFile, plistFileString);
};

const updateNseEnv = (
  options: CustomerIOPluginOptionsIOS,
  envFileName: string
) => {
  const SITE_ID_RE = /\{\{SITE_ID\}\}/;
  const API_KEY_RE = /\{\{API_KEY\}\}/;
  const REGION_RE = /\{\{REGION\}\}/;

  let envFileContent = FileManagement.readFile(envFileName);

  if (options.pushNotification?.env?.siteId) {
    envFileContent = replaceCodeByRegex(
      envFileContent,
      SITE_ID_RE,
      options.pushNotification?.env?.siteId
    );
  }

  if (options.pushNotification?.env?.apiKey) {
    envFileContent = replaceCodeByRegex(
      envFileContent,
      API_KEY_RE,
      options.pushNotification?.env?.apiKey
    );
  }

  if (options.pushNotification?.env?.region) {
    const regionMap = {
      us: 'Region.US',
      eu: 'Region.EU',
    };
    const region = options.pushNotification?.env?.region?.toLowerCase();
    const mappedRegion = (regionMap as any)[region] || '';
    if (!mappedRegion) {
      console.warn(
        `${options.pushNotification?.env?.region} is an invalid region. Please use the values from the docs: https://customer.io/docs/sdk/expo/getting-started/#configure-the-plugin`
      );
    } else {
      envFileContent = replaceCodeByRegex(
        envFileContent,
        REGION_RE,
        mappedRegion
      );
    }
  }

  FileManagement.writeFile(envFileName, envFileContent);
};

async function addPushNotificationFile(
  options: CustomerIOPluginOptionsIOS,
  xcodeProject: any
) {
  const { iosPath, appName } = options;
  const file = 'PushService.swift';
  const appPath = `${iosPath}/${appName}`;
  const getTargetFile = (filename: string) => `${appPath}/${filename}`;
  const targetFile = getTargetFile(file);

  // Check whether {file} exists in the project. If false, then add the file
  // If {file} exists then skip and return
  if (!FileManagement.exists(getTargetFile(file))) {
    FileManagement.mkdir(appPath, {
      recursive: true,
    });

    FileManagement.copyFile(
      `${LOCAL_PATH_TO_CIO_NSE_FILES}/${file}`,
      targetFile
    );
  } else {
    console.log(`${getTargetFile(file)} already exists. Skipping...`);
    return;
  }

  updatePushFile(options, targetFile);

  const group = xcodeProject.pbxCreateGroup('CustomerIONotifications');
  const classesKey = xcodeProject.findPBXGroupKey({ name: `${appName}` });
  xcodeProject.addToPbxGroup(group, classesKey);

  xcodeProject.addSourceFile(`${appName}/${file}`, null, group);
}

const updatePushFile = (
  options: CustomerIOPluginOptionsIOS,
  envFileName: string
) => {
  const REGISTER_RE = /\{\{REGISTER_SNIPPET\}\}/;

  let envFileContent = FileManagement.readFile(envFileName);

  let snippet = '';
  if (
    options.disableNotificationRegistration !== undefined &&
    options.disableNotificationRegistration === false
  ) {
    snippet = CIO_REGISTER_PUSHNOTIFICATION_SNIPPET;
  }

  envFileContent = replaceCodeByRegex(envFileContent, REGISTER_RE, snippet);

  FileManagement.writeFile(envFileName, envFileContent);
};
