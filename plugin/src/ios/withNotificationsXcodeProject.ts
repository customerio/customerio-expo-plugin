import type { ConfigPlugin, XcodeProject } from '@expo/config-plugins';
import { withXcodeProject } from '@expo/config-plugins';

import {
  CIO_NOTIFICATION_TARGET_NAME,
  CIO_REGISTER_PUSHNOTIFICATION_SNIPPET,
  DEFAULT_BUNDLE_VERSION,
} from '../helpers/constants/ios';
import { replaceCodeByRegex } from '../helpers/utils/codeInjection';
import { injectCIONotificationPodfileCode } from '../helpers/utils/injectCIOPodfileCode';
import type { CustomerIOPluginOptionsIOS, RichPushConfig } from '../types/cio-types';
import { getIosNativeFilesPath } from '../utils/plugin';
import { logWarning, validateRequired, validateString } from '../utils/validation';
import { FileManagement } from './../helpers/utils/fileManagement';
import { isExpoVersion53OrHigher, isFcmPushProvider } from './utils';

const PLIST_FILENAME = `${CIO_NOTIFICATION_TARGET_NAME}-Info.plist`;
const ENV_FILENAME = 'Env.swift';

const TARGETED_DEVICE_FAMILY = `"1,2"`;

const addNotificationServiceExtension = async (
  options: CustomerIOPluginOptionsIOS,
  xcodeProject: XcodeProject,
  isExpo53OrHigher: boolean,
) => {
  try {
    // PushService file is only needed for pre-Expo 53 code generation
    if (options.pushNotification && !isExpo53OrHigher) {
      await addPushNotificationFile(options, xcodeProject);
    }

    if (options.pushNotification?.useRichPush === true) {
      await addRichPushXcodeProj(options, xcodeProject);
    }
    return xcodeProject;
  } catch (error: unknown) {
    console.error(error);
    return null;
  }
};

export const withCioNotificationsXcodeProject: ConfigPlugin<
  CustomerIOPluginOptionsIOS
> = (configOuter, props) => {
  return withXcodeProject(configOuter, async (config) => {
    const { modRequest, ios, version: bundleShortVersion } = config;
    const { appleTeamId, iosDeploymentTarget, useFrameworks } = props;

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
    } satisfies CustomerIOPluginOptionsIOS;

    const modifiedProjectFile = await addNotificationServiceExtension(
      options,
      config.modResults,
      isExpoVersion53OrHigher(configOuter),
    );

    if (modifiedProjectFile) {
      config.modResults = modifiedProjectFile;
    }

    return config;
  });
};

const addRichPushXcodeProj = async (
  options: CustomerIOPluginOptionsIOS,
  xcodeProject: XcodeProject,
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

  const isFcmProvider = isFcmPushProvider(options);

  await injectCIONotificationPodfileCode(iosPath, useFrameworks, isFcmProvider);

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

  const platformSpecificFiles = ['NotificationService.swift'];

  const commonFiles = [
    PLIST_FILENAME,
    'NotificationService.h',
    'NotificationService.m',
    ENV_FILENAME,
  ];

  const getTargetFile = (filename: string) => `${nsePath}/${filename}`;
  // Copy platform-specific files
  platformSpecificFiles.forEach((filename) => {
    const targetFile = getTargetFile(filename);
    FileManagement.copyFile(
      `${getIosNativeFilesPath()}/${isFcmProvider ? 'fcm' : 'apn'
      }/${filename}`,
      targetFile
    );
  });

  // Copy common files
  commonFiles.forEach((filename) => {
    const targetFile = getTargetFile(filename);
    FileManagement.copyFile(
      `${getIosNativeFilesPath()}/common/${filename}`,
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
  updateNseEnv(getTargetFile(ENV_FILENAME), options.pushNotification?.env);

  // Create new PBXGroup for the extension
  const extGroup = xcodeProject.addPbxGroup(
    [...platformSpecificFiles, ...commonFiles], // Combine platform-specific and common files,
    CIO_NOTIFICATION_TARGET_NAME,
    CIO_NOTIFICATION_TARGET_NAME
  );

  // Add the new PBXGroup to the top level group. This makes the
  // files / folder appear in the file explorer in Xcode.
  const groups = xcodeProject.hash.project.objects.PBXGroup;
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
  projObjects.PBXTargetDependency = projObjects.PBXTargetDependency || {};
  projObjects.PBXContainerItemProxy = projObjects.PBXTargetDependency || {};

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
        iosDeploymentTarget || '15.1';
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
  envFileName: string,
  richPushConfig?: RichPushConfig
) => {
  const CDP_API_KEY_RE = /\{\{CDP_API_KEY\}\}/;
  const REGION_RE = /\{\{REGION\}\}/;

  let envFileContent = FileManagement.readFile(envFileName);

  // Use merged config values (config takes precedence over env)
  const cdpApiKey = richPushConfig?.cdpApiKey;
  const region = richPushConfig?.region;

  const hasValidCdpApiKey = validateRequired(cdpApiKey, 'cdpApiKey', 'NotificationServiceExtension') &&
    validateString(cdpApiKey, 'cdpApiKey', 'NotificationServiceExtension');

  if (!hasValidCdpApiKey) {
    logWarning(
      'NotificationServiceExtension failed: cdpApiKey missing or invalid. Provide in config.cdpApiKey or ios.pushNotification.env.cdpApiKey.'
    );
  }

  envFileContent = replaceCodeByRegex(
    envFileContent,
    CDP_API_KEY_RE,
    cdpApiKey || ''
  );

  // Always replace region - use provided value or fallback to 'us'
  const regionMap = {
    us: 'Region.US',
    eu: 'Region.EU',
  };
  const regionToUse = region || 'us';
  const mappedRegion = regionMap[regionToUse.toLowerCase() as keyof typeof regionMap];

  if (!mappedRegion) {
    logWarning(
      `${regionToUse} is an invalid region. Please use the values from the docs: https://customer.io/docs/sdk/expo/getting-started/#configure-the-plugin`
    );
    // Fallback to US if invalid region provided
    envFileContent = replaceCodeByRegex(envFileContent, REGION_RE, regionMap.us);
  } else {
    envFileContent = replaceCodeByRegex(envFileContent, REGION_RE, mappedRegion);
  }

  FileManagement.writeFile(envFileName, envFileContent);
};

async function addPushNotificationFile(
  options: CustomerIOPluginOptionsIOS,
  xcodeProject: XcodeProject
) {
  // Maybe copy a different file with FCM config based on config
  const { iosPath, appName } = options;
  const isFcmProvider = isFcmPushProvider(options);
  // PushService.swift is platform-specific and always lives in the platform folder
  const sourceFile = `${isFcmProvider ? 'fcm' : 'apn'}/PushService.swift`;
  const targetFileName = 'PushService.swift';
  const appPath = `${iosPath}/${appName}`;
  const getTargetFile = (filename: string) => `${appPath}/${filename}`;
  const targetFile = getTargetFile(targetFileName);

  // Check whether {file} exists in the project. If false, then add the file
  // If {file} exists then skip and return
  if (!FileManagement.exists(getTargetFile(targetFileName))) {
    FileManagement.mkdir(appPath, {
      recursive: true,
    });

    FileManagement.copyFile(
      `${getIosNativeFilesPath()}/${sourceFile}`,
      targetFile
    );
  } else {
    console.log(`${getTargetFile(targetFileName)} already exists. Skipping...`);
    return;
  }

  updatePushFile(options, targetFile);

  const group = xcodeProject.pbxCreateGroup('CustomerIONotifications');
  const classesKey = xcodeProject.findPBXGroupKey({ name: `${appName}` });
  xcodeProject.addToPbxGroup(group, classesKey);

  xcodeProject.addSourceFile(`${appName}/${targetFileName}`, null, group);
}

const updatePushFile = (
  options: CustomerIOPluginOptionsIOS,
  envFileName: string
) => {
  const REGISTER_RE = /\{\{REGISTER_SNIPPET\}\}/;

  let envFileContent = FileManagement.readFile(envFileName);
  const disableNotificationRegistration =
    options.pushNotification?.disableNotificationRegistration;
  const { cdpApiKey, region } = options.pushNotification?.env || {
    cdpApiKey: undefined,
    region: undefined,
  };
  const hasValidCdpApiKey = validateRequired(cdpApiKey, 'cdpApiKey', 'NotificationServiceExtension') &&
    validateString(cdpApiKey, 'cdpApiKey', 'NotificationServiceExtension');

  if (!hasValidCdpApiKey) {
    logWarning(
      'Adding NotificationServiceExtension failed: ios.pushNotification.env.cdpApiKey is missing or invalid from app.config.js or app.json.'
    );
  }

  let snippet = '';
  // unless this property is explicitly set to true, push notification
  // registration will be added to the AppDelegate
  if (disableNotificationRegistration !== true) {
    snippet = CIO_REGISTER_PUSHNOTIFICATION_SNIPPET;
  }
  envFileContent = replaceCodeByRegex(envFileContent, REGISTER_RE, snippet);

  envFileContent = replaceCodeByRegex(
    envFileContent,
    /\{\{CDP_API_KEY\}\}/,
    cdpApiKey || ''
  );

  if (region) {
    envFileContent = replaceCodeByRegex(
      envFileContent,
      /\{\{REGION\}\}/,
      region.toUpperCase()
    );
  }

  const autoTrackPushEvents =
    options.pushNotification?.autoTrackPushEvents !== false;
  envFileContent = replaceCodeByRegex(
    envFileContent,
    /\{\{AUTO_TRACK_PUSH_EVENTS\}\}/,
    autoTrackPushEvents.toString()
  );

  const autoFetchDeviceToken =
    options.pushNotification?.autoFetchDeviceToken !== false;
  envFileContent = replaceCodeByRegex(
    envFileContent,
    /\{\{AUTO_FETCH_DEVICE_TOKEN\}\}/,
    autoFetchDeviceToken.toString()
  );

  const showPushAppInForeground =
    options.pushNotification?.showPushAppInForeground !== false;
  envFileContent = replaceCodeByRegex(
    envFileContent,
    /\{\{SHOW_PUSH_APP_IN_FOREGROUND\}\}/,
    showPushAppInForeground.toString()
  );

  FileManagement.writeFile(envFileName, envFileContent);
};
