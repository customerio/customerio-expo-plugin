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
import {
  installCustomLiveActivityWidget,
  resolveCustomLiveActivityWidget,
  type ResolvedCustomWidget,
} from '../helpers/utils/liveNotificationCustomWidget';
import { installIosLiveNotificationLogo } from '../helpers/utils/liveNotificationLogo';
import {
  generateWidgetBundleSwift,
  resolveLiveNotificationTypes,
  validateLiveNotificationBranding,
} from '../helpers/utils/patchLiveNotificationCode';
import type {
  CustomerIOPluginLiveNotificationsOptions,
  CustomerIOPluginOptionsIOS,
  LiveNotificationsSDKConfig,
} from '../types/cio-types';
import { logger } from '../utils/logger';
import { getIosNativeFilesPath } from '../utils/plugin';

const PLIST_FILENAME = `${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME}-Info.plist`;
const WIDGET_BUNDLE_FILENAME = 'CIOLiveActivityWidgetBundle.swift';
const ASSET_CATALOG_FILENAME = 'Assets.xcassets';

// Files the plugin itself writes into the widget directory. A source file copied in from the app
// must not shadow one of them — everything lands in this one flat directory.
const GENERATED_WIDGET_FILENAMES = [
  WIDGET_BUNDLE_FILENAME,
  PLIST_FILENAME,
  ASSET_CATALOG_FILENAME,
];

// Widget files registered in the Xcode group; `customFilenames` are the app's own SwiftUI files (see
// `liveNotifications.customWidget`), so both lists are computed rather than fixed. Swift files are
// compiled (Sources phase); the Info.plist is referenced via INFOPLIST_FILE (set by `addTarget`) but
// still listed in the group so it appears in the Xcode navigator.
const widgetSourceFiles = (customFilenames: string[] = []): string[] => [
  WIDGET_BUNDLE_FILENAME,
  ...customFilenames,
];
const widgetGroupFiles = (
  customFilenames: string[] = [],
  resourceFiles: string[] = []
): string[] => [
  ...widgetSourceFiles(customFilenames),
  PLIST_FILENAME,
  ...resourceFiles,
];

const TARGETED_DEVICE_FAMILY = `"1,2"`;
// WidgetKit + SwiftUI + ActivityKit need Swift 5; the NSE target uses 4.2 for its ObjC-heavy code.
const WIDGET_SWIFT_VERSION = '5.0';

export type AddLiveActivityWidgetTargetOptions = {
  appleTeamId?: string;
  bundleIdentifier?: string;
  iosDeploymentTarget?: string;
  /** Asset catalog filename to compile into the widget, when a branding logo was installed. */
  assetCatalogFilename?: string;
  /** Swift files copied in from the app (`liveNotifications.customWidget`), to compile too. */
  customSourceFilenames?: string[];
};

/**
 * Injects a WidgetKit app-extension target that renders the Customer.io built-in Live Activity
 * templates, plus the app's own SwiftUI when `liveNotifications.customWidget` names some. Clones the
 * NotificationServiceExtension injection pattern: copies the widget template files, appends the
 * widget Podfile target block, and registers the target/group/build-phases in the parsed Xcode
 * project.
 *
 * Only the *contents* of the widget directory are re-synced once the target exists — see
 * {@link addLiveActivityWidget}.
 */
export const withCioLiveActivityWidgetXcodeProject: ConfigPlugin<{
  /**
   * Optional: an app can enable Live Notifications without declaring an `ios` block at all, and only
   * the optional `appleTeamId`/`useFrameworks` are read from it. Everything else the target needs
   * comes from the Expo config or from fixed defaults.
   */
  props?: CustomerIOPluginOptionsIOS;
  /** SDK config (automatic initialization): the enabled types and `customType`. */
  liveNotifications?: LiveNotificationsSDKConfig;
  /**
   * Build-time plugin options, which carry `customWidget` and `branding` on either initialization
   * path. Both are compiled into this widget, so neither can come from SDK config — that only
   * exists when the app initializes automatically.
   */
  buildOptions?: CustomerIOPluginLiveNotificationsOptions;
}> = (configOuter, { props, liveNotifications, buildOptions }) => {
  return withXcodeProject(configOuter, async (config) => {
    const { modRequest, ios, version: bundleShortVersion } = config;
    const { appleTeamId, useFrameworks } = props ?? {};
    // Fixed at the ActivityKit floor. Custom SwiftUI needing newer APIs uses availability
    // annotations (`if #available(iOS 17, *)`), which work fine at this deployment target.
    const iosDeploymentTarget = DEFAULT_LIVE_ACTIVITY_DEPLOYMENT_TARGET;

    validateLiveNotificationBranding(buildOptions?.branding);

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
          buildOptions,
          autoInitializes: liveNotifications !== undefined,
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
  buildOptions?: CustomerIOPluginLiveNotificationsOptions;
  /** True when the app initializes the SDK automatically (an SDK config is present). */
  autoInitializes: boolean;
  projectRoot: string;
};

/**
 * Writes the widget directory and registers the target.
 *
 * **A re-run against a project that already has the target only refreshes file contents.** The
 * group and build-phase entries were written by the first run and are keyed by file name, so a file
 * that is *added* or *renamed* afterwards cannot be registered here — that needs
 * `expo prebuild --clean`. Contents are still rewritten (the generated bundle, the app's custom
 * SwiftUI, the branding asset) so the common case, iterating on a widget's SwiftUI, works without a
 * clean prebuild.
 */
const addLiveActivityWidget = async (
  options: AddLiveActivityWidgetInternalOptions,
  xcodeProject: XcodeProject
) => {
  const { iosPath, useFrameworks, iosDeploymentTarget } = options;

  await injectCIOLiveActivityWidgetPodfileCode(iosPath, useFrameworks);

  const widgetPath = `${iosPath}/${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME}`;
  const getTargetFile = (filename: string) => `${widgetPath}/${filename}`;
  FileManagement.mkdir(widgetPath, { recursive: true });

  const customWidget = resolveCustomLiveActivityWidget({
    liveNotifications: options.liveNotifications,
    buildOptions: options.buildOptions,
    autoInitializes: options.autoInitializes,
    projectRoot: options.projectRoot,
    reservedFilenames: GENERATED_WIDGET_FILENAMES,
  });

  const writeWidgetSources = (): {
    customSourceFilenames: string[];
    assetCatalogPath: string | null;
  } => {
    // The widget bundle is generated, not copied: it must render exactly the enabled types, and iOS
    // branding is SwiftUI compiled into the widget, so it can only be applied here.
    FileManagement.writeFile(
      getTargetFile(WIDGET_BUNDLE_FILENAME),
      generateWidgetBundleSwift(
        resolveLiveNotificationTypes(options.liveNotifications?.types),
        options.buildOptions?.branding,
        customWidget?.structName,
        options.autoInitializes
      )
    );

    // iOS branding is SwiftUI compiled into the widget, so a local logo has to become a real asset
    // in this target — the generated bundle references it by name.
    const assetCatalogPath = installIosLiveNotificationLogo(
      options.buildOptions?.branding,
      widgetPath,
      options.projectRoot
    );

    return {
      customSourceFilenames: customWidget
        ? installCustomLiveActivityWidget(customWidget, widgetPath)
        : [],
      assetCatalogPath,
    };
  };

  if (xcodeProject.pbxTargetByName(CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME)) {
    logger.warn(
      `${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME} already exists in project. Refreshing its generated files ` +
        'only — files added or renamed since it was created cannot be registered on an existing target. ' +
        'Run `expo prebuild --clean` to regenerate it from scratch.'
    );
    writeWidgetSources();
    warnAboutUnregisteredSources(xcodeProject, customWidget);
    return;
  }

  const sourceDir = `${getIosNativeFilesPath()}/widget`;
  FileManagement.copyFile(
    `${sourceDir}/${PLIST_FILENAME}`,
    getTargetFile(PLIST_FILENAME)
  );

  const { customSourceFilenames, assetCatalogPath } = writeWidgetSources();

  updateWidgetInfoPlist({
    infoPlistTargetFile: getTargetFile(PLIST_FILENAME),
    bundleVersion: options.bundleVersion,
    bundleShortVersion: options.bundleShortVersion,
  });

  addLiveActivityWidgetToXcodeProject(xcodeProject, {
    appleTeamId: options.appleTeamId,
    bundleIdentifier: options.bundleIdentifier,
    iosDeploymentTarget,
    assetCatalogFilename: assetCatalogPath ? ASSET_CATALOG_FILENAME : undefined,
    customSourceFilenames,
  });
};

/**
 * On a refresh-only run, a custom source file whose name isn't already in the project was added or
 * renamed after the target was created, so nothing compiles it. Name it rather than leaving the
 * failure to show up as a missing symbol at build time.
 */
function warnAboutUnregisteredSources(
  xcodeProject: XcodeProject,
  customWidget: ResolvedCustomWidget | null
): void {
  if (!customWidget) return;

  const unregistered = customWidget.filenames.filter(
    (filename) => !hasFileReference(xcodeProject, filename)
  );
  if (unregistered.length === 0) return;

  logger.warn(
    `${unregistered.join(', ')} ${unregistered.length === 1 ? 'is' : 'are'} not registered on the existing ` +
      `${CIO_LIVE_ACTIVITY_WIDGET_TARGET_NAME} target, so ${unregistered.length === 1 ? 'it' : 'they'} will not ` +
      'be compiled. Run `expo prebuild --clean` to pick up new or renamed custom widget files.'
  );
}

function hasFileReference(xcodeProject: XcodeProject, filename: string): boolean {
  const references = xcodeProject.hash.project.objects.PBXFileReference ?? {};
  return Object.keys(references).some((key) => {
    const reference = references[key];
    if (typeof reference !== 'object' || reference === null) return false;
    const value = String(reference.path ?? reference.name ?? '').replace(/"/g, '');
    return value === filename || value.endsWith(`/${filename}`);
  });
}

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

  const {
    appleTeamId,
    bundleIdentifier,
    iosDeploymentTarget,
    assetCatalogFilename,
    customSourceFilenames = [],
  } = options;
  const resourceFiles = assetCatalogFilename ? [assetCatalogFilename] : [];

  // Create new PBXGroup for the widget files.
  const widgetGroup = xcodeProject.addPbxGroup(
    widgetGroupFiles(customSourceFilenames, resourceFiles),
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
    widgetSourceFiles(customSourceFilenames),
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
