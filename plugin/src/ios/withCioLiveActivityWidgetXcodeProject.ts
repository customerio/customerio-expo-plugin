import type { ConfigPlugin, XcodeProject } from '@expo/config-plugins';
import { withXcodeProject } from '@expo/config-plugins';

import {
  CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME,
  DEFAULT_BUNDLE_VERSION,
  DEFAULT_LIVE_ACTIVITY_DEPLOYMENT_TARGET,
} from '../helpers/constants/ios';
import { replaceCodeByRegex } from '../helpers/utils/codeInjection';
import { FileManagement } from '../helpers/utils/fileManagement';
import { injectCIOLiveActivityWidgetPodfileCode } from '../helpers/utils/injectCIOPodfileCode';
import { installIosLiveNotificationLogo } from '../helpers/utils/liveNotificationLogo';
import {
  generateWidgetBundleSwift,
  resolveLiveNotificationTypes,
  validateLiveNotificationBranding,
} from '../helpers/utils/patchLiveNotificationCode';
import type {
  CustomerIOPluginOptionsIOS,
  LiveNotificationsSDKConfig,
} from '../types/cio-types';
import { logger } from '../utils/logger';
import { getIosNativeFilesPath } from '../utils/plugin';

const PLIST_FILENAME = `${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME}-Info.plist`;
const WIDGET_BUNDLE_FILENAME = 'CIOLiveActivityWidgetBundle.swift';
const ASSET_CATALOG_FILENAME = 'Assets.xcassets';

// Widget source files registered in the Xcode group AND copied to the target directory. The Swift
// file is compiled (Sources phase); the Info.plist is referenced via INFOPLIST_FILE (set by
// `addTarget`) but still listed in the group so it appears in the Xcode navigator.
const WIDGET_SOURCE_FILES = [WIDGET_BUNDLE_FILENAME];
const WIDGET_GROUP_FILES = [WIDGET_BUNDLE_FILENAME, PLIST_FILENAME];

const TARGETED_DEVICE_FAMILY = `"1,2"`;
// WidgetKit + SwiftUI + ActivityKit need Swift 5; the NSE target uses 4.2 for its ObjC-heavy code.
const WIDGET_SWIFT_VERSION = '5.0';

export type AddLiveActivityWidgetTargetOptions = {
  appleTeamId?: string;
  bundleIdentifier?: string;
  iosDeploymentTarget?: string;
  /** Asset catalog filename to compile into the widget, when a branding logo was installed. */
  assetCatalogFilename?: string;
};

/**
 * Injects a WidgetKit app-extension target that renders the Customer.io built-in Live Activity
 * templates. Clones the NotificationServiceExtension injection pattern: copies the widget template
 * files, appends the widget Podfile target block, and registers the target/group/build-phases in
 * the parsed Xcode project. Idempotent — bails if the target already exists.
 */
export const withCioLiveActivityWidgetXcodeProject: ConfigPlugin<{
  props: CustomerIOPluginOptionsIOS;
  liveNotifications?: LiveNotificationsSDKConfig;
}> = (configOuter, { props, liveNotifications }) => {
  return withXcodeProject(configOuter, async (config) => {
    const { modRequest, ios, version: bundleShortVersion } = config;
    const { appleTeamId, useFrameworks } = props;
    // Fixed: the bundle only renders SDK-provided SwiftUI, whose floor is set by the Templates pod.
    const iosDeploymentTarget = DEFAULT_LIVE_ACTIVITY_DEPLOYMENT_TARGET;

    validateLiveNotificationBranding(liveNotifications?.branding);

    if (ios === undefined) {
      throw new Error(
        'Adding Live Activity widget failed: ios config missing from app.config.js or app.json.'
      );
    }

    const { projectName, platformProjectRoot } = modRequest;
    const { bundleIdentifier, buildNumber } = ios;

    if (bundleIdentifier === undefined) {
      throw new Error(
        'Adding Live Activity widget failed: ios.bundleIdentifier missing from app.config.js or app.json.'
      );
    }

    if (projectName === undefined) {
      throw new Error(
        'Adding Live Activity widget failed: name missing from app.config.js or app.json.'
      );
    }

    try {
      await addLiveActivityWidget(
        {
          iosPath: platformProjectRoot,
          bundleIdentifier,
          bundleShortVersion,
          bundleVersion: buildNumber || DEFAULT_BUNDLE_VERSION,
          appleTeamId,
          iosDeploymentTarget,
          useFrameworks,
          liveNotifications,
          projectRoot: modRequest.projectRoot,
        },
        config.modResults
      );
    } catch (error: unknown) {
      logger.error(String(error));
    }

    return config;
  });
};

type AddLiveActivityWidgetInternalOptions = {
  iosPath: string;
  bundleIdentifier: string;
  bundleShortVersion?: string;
  bundleVersion: string;
  appleTeamId?: string;
  iosDeploymentTarget: string;
  useFrameworks?: CustomerIOPluginOptionsIOS['useFrameworks'];
  liveNotifications?: LiveNotificationsSDKConfig;
  projectRoot: string;
};

const addLiveActivityWidget = async (
  options: AddLiveActivityWidgetInternalOptions,
  xcodeProject: XcodeProject
) => {
  const { iosPath, useFrameworks, iosDeploymentTarget } = options;

  await injectCIOLiveActivityWidgetPodfileCode(iosPath, useFrameworks);

  // Bail out early if the target is already present. The pbxproj helper is idempotent too, but this
  // also avoids redundant file copies when prebuild re-runs against an already-prepared project.
  if (xcodeProject.pbxTargetByName(CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME)) {
    logger.warn(
      `${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME} already exists in project. Skipping...`
    );
    return;
  }

  const widgetPath = `${iosPath}/${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME}`;
  FileManagement.mkdir(widgetPath, { recursive: true });

  const getTargetFile = (filename: string) => `${widgetPath}/${filename}`;
  const sourceDir = `${getIosNativeFilesPath()}/widget`;

  WIDGET_GROUP_FILES.filter((filename) => filename !== WIDGET_BUNDLE_FILENAME).forEach(
    (filename) => {
      FileManagement.copyFile(`${sourceDir}/${filename}`, getTargetFile(filename));
    }
  );

  // The widget bundle is generated, not copied: it must render exactly the enabled types, and iOS
  // branding is SwiftUI compiled into the widget, so it can only be applied here.
  FileManagement.writeFile(
    getTargetFile(WIDGET_BUNDLE_FILENAME),
    generateWidgetBundleSwift(
      resolveLiveNotificationTypes(options.liveNotifications?.types),
      options.liveNotifications?.branding
    )
  );

  updateWidgetInfoPlist({
    infoPlistTargetFile: getTargetFile(PLIST_FILENAME),
    bundleVersion: options.bundleVersion,
    bundleShortVersion: options.bundleShortVersion,
  });

  // iOS branding is SwiftUI compiled into the widget, so a local logo has to become a real asset
  // in this target — the generated bundle references it by name.
  const assetCatalogPath = installIosLiveNotificationLogo(
    options.liveNotifications?.branding,
    widgetPath,
    options.projectRoot
  );

  addLiveActivityWidgetToXcodeProject(xcodeProject, {
    appleTeamId: options.appleTeamId,
    bundleIdentifier: options.bundleIdentifier,
    iosDeploymentTarget,
    assetCatalogFilename: assetCatalogPath ? ASSET_CATALOG_FILENAME : undefined,
  });
};

/**
 * Pure string transform: substitutes the `{{BUNDLE_VERSION}}` and `{{BUNDLE_SHORT_VERSION}}`
 * placeholders in the widget Info.plist template. Exported for tests.
 */
export function applyBundleVersionToWidgetPlist(
  content: string,
  payload: { bundleVersion?: string; bundleShortVersion?: string }
): string {
  let next = content;
  if (payload.bundleVersion) {
    next = replaceCodeByRegex(
      next,
      /\{\{BUNDLE_VERSION\}\}/,
      payload.bundleVersion
    );
  }
  if (payload.bundleShortVersion) {
    next = replaceCodeByRegex(
      next,
      /\{\{BUNDLE_SHORT_VERSION\}\}/,
      payload.bundleShortVersion
    );
  }
  return next;
}

const updateWidgetInfoPlist = (payload: {
  bundleVersion?: string;
  bundleShortVersion?: string;
  infoPlistTargetFile: string;
}) => {
  const next = applyBundleVersionToWidgetPlist(
    FileManagement.readFile(payload.infoPlistTargetFile),
    payload
  );
  FileManagement.writeFile(payload.infoPlistTargetFile, next);
};

/**
 * Mutates the parsed XcodeProject to register the Live Activity widget extension target: creates a
 * PBXGroup for its files, registers the group under the project's top-level group, adds the
 * app_extension target (which auto-wires the host app's "Embed App Extensions" copy-files phase),
 * wires the three build phases, and configures deployment target / Swift version / signing.
 *
 * Idempotent — returns the project unchanged if the widget target already exists.
 */
export function addLiveActivityWidgetToXcodeProject(
  xcodeProject: XcodeProject,
  options: AddLiveActivityWidgetTargetOptions
): XcodeProject {
  if (xcodeProject.pbxTargetByName(CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME)) {
    logger.warn(
      `${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME} already exists in project. Skipping...`
    );
    return xcodeProject;
  }

  const { appleTeamId, bundleIdentifier, iosDeploymentTarget, assetCatalogFilename } =
    options;
  const resourceFiles = assetCatalogFilename ? [assetCatalogFilename] : [];

  // Create new PBXGroup for the widget files.
  const widgetGroup = xcodeProject.addPbxGroup(
    [...WIDGET_GROUP_FILES, ...resourceFiles],
    CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME,
    CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME
  );

  // Attach the group to the top-level (nameless/pathless) PBXGroup so it appears in Xcode.
  const groups = xcodeProject.hash.project.objects.PBXGroup;
  Object.keys(groups).forEach((key) => {
    if (groups[key].name === undefined && groups[key].path === undefined) {
      xcodeProject.addToPbxGroup(widgetGroup.uuid, key);
    }
  });

  // WORK AROUND for xcodeProject.addTarget BUG (cordova-node-xcode): single-target projects lack
  // these sections, which addTarget assumes exist.
  const projObjects = xcodeProject.hash.project.objects;
  projObjects.PBXTargetDependency = projObjects.PBXTargetDependency || {};
  projObjects.PBXContainerItemProxy = projObjects.PBXContainerItemProxy || {};

  // Bundle id must be prefixed by the host app's bundle id for an app extension.
  const widgetTarget = xcodeProject.addTarget(
    CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME,
    'app_extension',
    CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME,
    `${bundleIdentifier}.${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME}`
  );

  // Add build phases to the new target.
  xcodeProject.addBuildPhase(
    WIDGET_SOURCE_FILES,
    'PBXSourcesBuildPhase',
    'Sources',
    widgetTarget.uuid
  );
  xcodeProject.addBuildPhase(
    resourceFiles,
    'PBXResourcesBuildPhase',
    'Resources',
    widgetTarget.uuid
  );
  xcodeProject.addBuildPhase(
    [],
    'PBXFrameworksBuildPhase',
    'Frameworks',
    widgetTarget.uuid
  );

  // Edit the deployment info of the target.
  const configurations = xcodeProject.pbxXCBuildConfigurationSection();
  for (const key in configurations) {
    if (
      typeof configurations[key].buildSettings !== 'undefined' &&
      configurations[key].buildSettings.PRODUCT_NAME ===
        `"${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME}"`
    ) {
      const buildSettingsObj = configurations[key].buildSettings;
      buildSettingsObj.DEVELOPMENT_TEAM = appleTeamId;
      buildSettingsObj.IPHONEOS_DEPLOYMENT_TARGET =
        iosDeploymentTarget || DEFAULT_LIVE_ACTIVITY_DEPLOYMENT_TARGET;
      buildSettingsObj.TARGETED_DEVICE_FAMILY = TARGETED_DEVICE_FAMILY;
      buildSettingsObj.CODE_SIGN_STYLE = 'Automatic';
      buildSettingsObj.SWIFT_VERSION = WIDGET_SWIFT_VERSION;
    }
  }

  // Stamp the development team on the widget target and the project's main target.
  xcodeProject.addTargetAttribute('DevelopmentTeam', appleTeamId, widgetTarget);
  xcodeProject.addTargetAttribute('DevelopmentTeam', appleTeamId);

  return xcodeProject;
}
