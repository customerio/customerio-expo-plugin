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
import { logger } from '../utils/logger';
import { getIosNativeFilesPath } from '../utils/plugin';
import { validateRichPushConfig } from '../utils/validation';
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
    logger.error(String(error));
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

const NSE_ENTITLEMENTS_FILENAME = 'NotificationService.entitlements';

export type AddNseTargetToXcodeProjectOptions = {
  appleTeamId?: string;
  bundleIdentifier?: string;
  iosDeploymentTarget?: string;
  appGroupId?: string;
};

/**
 * Mutates the parsed XcodeProject to register the rich-push NotificationService
 * extension target: creates a PBXGroup for its files, registers the group under
 * the project's top-level group, adds the app_extension target, wires three
 * build phases (Sources, Resources, Frameworks), configures the target's build
 * settings (DEVELOPMENT_TEAM, IPHONEOS_DEPLOYMENT_TARGET, code-sign style,
 * Swift version, and CODE_SIGN_ENTITLEMENTS when `appGroupId` is set), and
 * stamps the development team attribute on both the new target and the
 * project's main target attributes.
 *
 * Idempotent — returns the project unchanged if a target named
 * `CIO_NOTIFICATION_TARGET_NAME` is already present.
 */
export function addNotificationServiceExtensionToXcodeProject(
  xcodeProject: XcodeProject,
  options: AddNseTargetToXcodeProjectOptions,
): XcodeProject {
  if (xcodeProject.pbxTargetByName(CIO_NOTIFICATION_TARGET_NAME)) {
    logger.warn(
      `${CIO_NOTIFICATION_TARGET_NAME} already exists in project. Skipping...`,
    );
    return xcodeProject;
  }

  const { appleTeamId, bundleIdentifier, iosDeploymentTarget, appGroupId } = options;

  const platformSpecificFiles = ['NotificationService.swift'];
  const commonFiles = [
    PLIST_FILENAME,
    'NotificationService.h',
    'NotificationService.m',
    ENV_FILENAME,
  ];
  // The entitlements file is generated (not copied from source), so it's listed separately
  // for the Xcode group so it appears in the file navigator.
  const allGroupFiles = [
    ...platformSpecificFiles,
    ...commonFiles,
    ...(appGroupId ? [NSE_ENTITLEMENTS_FILENAME] : []),
  ];

  // Create new PBXGroup for the extension
  const extGroup = xcodeProject.addPbxGroup(
    allGroupFiles,
    CIO_NOTIFICATION_TARGET_NAME,
    CIO_NOTIFICATION_TARGET_NAME,
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

  // Add the NSE target. This also adds PBXTargetDependency and PBXContainerItemProxy.
  const nseTarget = xcodeProject.addTarget(
    CIO_NOTIFICATION_TARGET_NAME,
    'app_extension',
    CIO_NOTIFICATION_TARGET_NAME,
    `${bundleIdentifier}.richpush`,
  );

  // Add build phases to the new target
  xcodeProject.addBuildPhase(
    ['NotificationService.m', 'NotificationService.swift', 'Env.swift'],
    'PBXSourcesBuildPhase',
    'Sources',
    nseTarget.uuid,
  );
  xcodeProject.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', nseTarget.uuid);
  xcodeProject.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', nseTarget.uuid);

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
      buildSettingsObj.IPHONEOS_DEPLOYMENT_TARGET = iosDeploymentTarget || '15.1';
      buildSettingsObj.TARGETED_DEVICE_FAMILY = TARGETED_DEVICE_FAMILY;
      buildSettingsObj.CODE_SIGN_STYLE = 'Automatic';
      buildSettingsObj.SWIFT_VERSION = 4.2;
      if (appGroupId) {
        buildSettingsObj.CODE_SIGN_ENTITLEMENTS = `${CIO_NOTIFICATION_TARGET_NAME}/${NSE_ENTITLEMENTS_FILENAME}`;
      }
    }
  }

  // Add development team to the target & the main
  xcodeProject.addTargetAttribute('DevelopmentTeam', appleTeamId, nseTarget);
  xcodeProject.addTargetAttribute('DevelopmentTeam', appleTeamId);

  return xcodeProject;
}

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
  const appGroupId = options.pushNotification?.appGroupId;

  await injectCIONotificationPodfileCode(iosPath, useFrameworks, isFcmProvider);

  // Skip the rest of the work if the NSE target is already in place. The pbxproj-mutating
  // helper has its own idempotency check, but bailing out here also avoids redundant file
  // copies and entitlements writes when prebuild re-runs against an already-prepared project.
  if (xcodeProject.pbxTargetByName(CIO_NOTIFICATION_TARGET_NAME)) {
    logger.warn(
      `${CIO_NOTIFICATION_TARGET_NAME} already exists in project. Skipping...`,
    );
    return;
  }

  const nsePath = `${iosPath}/${CIO_NOTIFICATION_TARGET_NAME}`;
  FileManagement.mkdir(nsePath, { recursive: true });

  // Write NSE entitlements file only when appGroupId is explicitly configured
  if (appGroupId) {
    const nseEntitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${appGroupId}</string>
  </array>
</dict>
</plist>
`;
    FileManagement.writeFile(`${nsePath}/${NSE_ENTITLEMENTS_FILENAME}`, nseEntitlementsContent);
  }

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
    FileManagement.copyFile(
      `${getIosNativeFilesPath()}/${isFcmProvider ? 'fcm' : 'apn'}/${filename}`,
      getTargetFile(filename),
    );
  });

  // Copy common files
  commonFiles.forEach((filename) => {
    FileManagement.copyFile(
      `${getIosNativeFilesPath()}/common/${filename}`,
      getTargetFile(filename),
    );
  });

  /* MODIFY COPIED EXTENSION FILES */
  updateNseInfoPlist({
    bundleVersion,
    bundleShortVersion,
    infoPlistTargetFile: getTargetFile(PLIST_FILENAME),
  });
  updateNseEnv(getTargetFile(ENV_FILENAME), options.pushNotification?.env);
  updateNseNotificationService(getTargetFile('NotificationService.swift'), appGroupId);

  // Register the NSE target in the parsed Xcode project
  addNotificationServiceExtensionToXcodeProject(xcodeProject, {
    appleTeamId,
    bundleIdentifier,
    iosDeploymentTarget,
    appGroupId,
  });
};

/**
 * Pure string transform: substitutes the `{{BUNDLE_VERSION}}` and
 * `{{BUNDLE_SHORT_VERSION}}` placeholders in the NSE Info.plist template.
 * Either or both may be provided; missing values leave the corresponding
 * placeholder untouched.
 */
export function applyBundleVersionToNsePlist(
  content: string,
  payload: { bundleVersion?: string; bundleShortVersion?: string }
): string {
  let next = content;
  if (payload.bundleVersion) {
    next = replaceCodeByRegex(next, /\{\{BUNDLE_VERSION\}\}/, payload.bundleVersion);
  }
  if (payload.bundleShortVersion) {
    next = replaceCodeByRegex(next, /\{\{BUNDLE_SHORT_VERSION\}\}/, payload.bundleShortVersion);
  }
  return next;
}

const updateNseInfoPlist = (payload: {
  bundleVersion?: string;
  bundleShortVersion?: string;
  infoPlistTargetFile: string;
}) => {
  const next = applyBundleVersionToNsePlist(
    FileManagement.readFile(payload.infoPlistTargetFile),
    payload,
  );
  FileManagement.writeFile(payload.infoPlistTargetFile, next);
};

/**
 * Pure string transform: substitutes the `{{APP_GROUP_ID_BUILDER_LINE}}`
 * placeholder in NotificationService.swift with either the configured
 * appGroupId builder line or an empty string.
 */
export function applyAppGroupIdToNotificationService(
  content: string,
  appGroupId?: string
): string {
  const builderLine = appGroupId
    ? `        .appGroupId(${JSON.stringify(appGroupId)})\n`
    : '';
  return replaceCodeByRegex(content, /\{\{APP_GROUP_ID_BUILDER_LINE\}\}/, builderLine);
}

const updateNseNotificationService = (
  notificationServiceFile: string,
  appGroupId?: string,
) => {
  const next = applyAppGroupIdToNotificationService(
    FileManagement.readFile(notificationServiceFile),
    appGroupId,
  );
  FileManagement.writeFile(notificationServiceFile, next);
};

/**
 * Pure string transform: substitutes the `{{CDP_API_KEY}}` and `{{REGION}}`
 * placeholders in the NSE Env.swift template. Missing or invalid region
 * falls back to `Region.US` and logs a warning.
 */
export function applyRichPushConfigToEnv(
  content: string,
  richPushConfig?: RichPushConfig,
): string {
  const cdpApiKey = richPushConfig?.cdpApiKey;
  const region = richPushConfig?.region;

  let next = replaceCodeByRegex(
    content,
    /\{\{CDP_API_KEY\}\}/,
    cdpApiKey || 'MISSING_API_KEY',
  );

  const regionKey = region?.toLowerCase() ?? '';
  const regionMap = { us: 'Region.US', eu: 'Region.EU' } as const;
  const mappedRegion = regionMap[regionKey as keyof typeof regionMap];
  if (!mappedRegion) {
    logger.warn(
      `${regionKey} is an invalid region. Please use the values from the docs: https://docs.customer.io/integrations/sdk/expo/getting-started/packages-options/#configuring-the-expo-plugin`
    );
    next = replaceCodeByRegex(next, /\{\{REGION\}\}/, regionMap.us);
  } else {
    next = replaceCodeByRegex(next, /\{\{REGION\}\}/, mappedRegion);
  }
  return next;
}

const updateNseEnv = (
  envFileName: string,
  richPushConfig?: RichPushConfig
) => {
  if (!validateRichPushConfig(richPushConfig)) {
    return;
  }
  const next = applyRichPushConfigToEnv(
    FileManagement.readFile(envFileName),
    richPushConfig,
  );
  FileManagement.writeFile(envFileName, next);
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
    logger.info(`${getTargetFile(targetFileName)} already exists. Skipping...`);
    return;
  }

  updatePushFile(options, targetFile);

  const group = xcodeProject.pbxCreateGroup('CustomerIONotifications');
  const classesKey = xcodeProject.findPBXGroupKey({ name: `${appName}` });
  xcodeProject.addToPbxGroup(group, classesKey);

  xcodeProject.addSourceFile(`${appName}/${targetFileName}`, null, group);
}

/**
 * Pure string transform: substitutes every PushService.swift placeholder
 * (`{{REGISTER_SNIPPET}}`, `{{CDP_API_KEY}}`, `{{REGION}}`,
 * `{{AUTO_TRACK_PUSH_EVENTS}}`, `{{AUTO_FETCH_DEVICE_TOKEN}}`,
 * `{{SHOW_PUSH_APP_IN_FOREGROUND}}`, `{{APP_GROUP_ID_BUILDER_LINE}}`) using
 * the configured push-notification options. Validation of the rich-push
 * config (cdpApiKey/region required) is the wrapper's responsibility.
 */
export function applyConfigToPushFile(
  content: string,
  options: CustomerIOPluginOptionsIOS,
): string {
  const richPushConfig = options.pushNotification?.env;
  const { cdpApiKey, region } = richPushConfig || {
    cdpApiKey: 'MISSING_API_KEY',
    region: undefined,
  };
  const disableNotificationRegistration =
    options.pushNotification?.disableNotificationRegistration;

  // unless this property is explicitly set to true, push notification
  // registration will be added to the AppDelegate
  const registerSnippet = disableNotificationRegistration !== true
    ? CIO_REGISTER_PUSHNOTIFICATION_SNIPPET
    : '';

  let next = replaceCodeByRegex(content, /\{\{REGISTER_SNIPPET\}\}/, registerSnippet);
  next = replaceCodeByRegex(next, /\{\{CDP_API_KEY\}\}/, cdpApiKey);

  if (region) {
    next = replaceCodeByRegex(next, /\{\{REGION\}\}/, region.toUpperCase());
  }

  const autoTrackPushEvents =
    options.pushNotification?.autoTrackPushEvents !== false;
  next = replaceCodeByRegex(
    next,
    /\{\{AUTO_TRACK_PUSH_EVENTS\}\}/,
    autoTrackPushEvents.toString(),
  );

  const autoFetchDeviceToken =
    options.pushNotification?.autoFetchDeviceToken !== false;
  next = replaceCodeByRegex(
    next,
    /\{\{AUTO_FETCH_DEVICE_TOKEN\}\}/,
    autoFetchDeviceToken.toString(),
  );

  const showPushAppInForeground =
    options.pushNotification?.showPushAppInForeground !== false;
  next = replaceCodeByRegex(
    next,
    /\{\{SHOW_PUSH_APP_IN_FOREGROUND\}\}/,
    showPushAppInForeground.toString(),
  );

  const appGroupId = options.pushNotification?.appGroupId;
  const appGroupIdBuilderLine = appGroupId
    ? `        .appGroupId(${JSON.stringify(appGroupId)})\n`
    : '';
  next = replaceCodeByRegex(
    next,
    /\{\{APP_GROUP_ID_BUILDER_LINE\}\}/,
    appGroupIdBuilderLine,
  );

  return next;
}

const updatePushFile = (
  options: CustomerIOPluginOptionsIOS,
  envFileName: string
) => {
  const richPushConfig = options.pushNotification?.env;
  if (!validateRichPushConfig(richPushConfig)) {
    return;
  }
  const next = applyConfigToPushFile(FileManagement.readFile(envFileName), options);
  FileManagement.writeFile(envFileName, next);
};
