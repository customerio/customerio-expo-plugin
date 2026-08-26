import type {
  ExportedConfigWithProps,
  XcodeProject,
} from '@expo/config-plugins';
import { withAppDelegate, withXcodeProject } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import path from 'path';
import { PLATFORM } from '../helpers/constants/common';
import {
  CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SWIFT_SNIPPET,
  CIO_MESSAGING_PUSH_APP_DELEGATE_INIT_REGEX,
  CIO_NATIVE_SDK_INITIALIZE_SNIPPET,
  CIO_REGISTER_PUSHNOTIFICATION_SNIPPET_v2,
  CIO_REGISTER_PUSH_NOTIFICATION_PLACEHOLDER,
} from '../helpers/constants/ios';
import { replaceCodeByRegex } from '../helpers/utils/codeInjection';
import { FileManagement } from '../helpers/utils/fileManagement';
import { patchNativeSDKInitializer } from '../helpers/utils/patchPluginNativeCode';
import type {
  CustomerIOPluginOptionsIOS,
  CustomerIOPluginLocationOptions,
  CustomerIOPluginGeofenceOptions,
  NativeSDKConfig,
} from '../types/cio-types';
import { logger } from '../utils/logger';
import { getIosNativeFilesPath } from '../utils/plugin';
import { copyFileToXcode, getOrCreateCustomerIOGroup } from '../utils/xcode';
import {
  addSwiftImports,
  hasExpoSceneLifecycle,
  isFcmPushProvider,
  maskSwiftNonCode,
} from './utils';

// Constants
const CIO_SDK_APP_DELEGATE_HANDLER_CLASS = 'CioSdkAppDelegateHandler';
const CIO_SDK_APP_DELEGATE_HANDLER_FILENAME = `${CIO_SDK_APP_DELEGATE_HANDLER_CLASS}.swift`;
const REACT_NATIVE_IMPORT = 'import customerio_reactnative';
const CONFIGURE_SCENE_ROUTING_CALL =
  'NativeCustomerIO.configureExpoSceneDeepLinkRouting()';
const CONFIGURE_SCENE_ROUTING_LINE_REGEX =
  /^[ \t]*NativeCustomerIO\.configureExpoSceneDeepLinkRouting\(\)[ \t]*$/m;
const PUSH_INITIALIZATION_LINE_REGEX =
  /^[ \t]*cioSdkHandler\.application\(application, didFinishLaunchingWithOptions: launchOptions\)[ \t]*$/m;
const NATIVE_INITIALIZATION_LINE_REGEX =
  /^[ \t]*CustomerIOSDKInitializer\.initialize\(\)[ \t]*$/m;
const APP_DELEGATE_HANDLER_DECLARATION_REGEX =
  /^[ \t]*let[ \t]+cioSdkHandler[ \t]*=[ \t]*CioSdkAppDelegateHandler\(\)[ \t]*$/m;

/**
 * Copy and configure the CioSdkAppDelegateHandler.swift file
 */
const copyAndConfigureAppDelegateHandler = (
  config: ExportedConfigWithProps<XcodeProject>,
  sdkConfig?: NativeSDKConfig,
  props?: CustomerIOPluginOptionsIOS,
  location?: CustomerIOPluginLocationOptions,
  geofence?: CustomerIOPluginGeofenceOptions
): ExportedConfigWithProps<XcodeProject> => {
  // Destination path in the iOS project
  const projectName = config.modRequest.projectName || '';
  if (!projectName) {
    logger.warn('Project name is undefined, cannot copy CustomerIO files');
    return config;
  }

  // Add files to the Xcode project
  const xcodeProject = config.modResults;
  const projectRoot = config.modRequest.projectRoot;
  const iosProjectRoot = path.join(projectRoot, 'ios');

  const group = getOrCreateCustomerIOGroup(xcodeProject, projectName);
  if (props?.pushNotification) {
    // Copy CioSdkAppDelegateHandler.swift for full push notification + auto-init support
    copyAndConfigurePushAppDelegateHandler({
      xcodeProject,
      group,
      iosProjectRoot,
      projectName,
      sdkConfig,
      props,
      location,
      geofence,
    });
  } else if (sdkConfig) {
    // Copy only CustomerIOSDKInitializer.swift for auto-init without push notifications
    copyAndConfigureNativeSDKInitializer({
      xcodeProject,
      group,
      iosProjectRoot,
      projectName,
      sdkConfig,
      location,
      geofence,
    });
  }

  return config;
};

const copyAndConfigurePushAppDelegateHandler = ({
  xcodeProject,
  group,
  iosProjectRoot,
  projectName,
  sdkConfig,
  props,
  location,
  geofence,
}: {
  xcodeProject: XcodeProject;
  group: string;
  iosProjectRoot: string;
  projectName: string;
  sdkConfig: NativeSDKConfig | undefined;
  props: CustomerIOPluginOptionsIOS;
  location?: CustomerIOPluginLocationOptions;
  geofence?: CustomerIOPluginGeofenceOptions;
}) => {
  const useFcm = isFcmPushProvider(props);

  // Source path for the handler file
  const handlerSourcePath = path.join(
    getIosNativeFilesPath(),
    useFcm ? 'fcm' : 'apn',
    CIO_SDK_APP_DELEGATE_HANDLER_FILENAME
  );

  const handlerDestPath = path.join(
    iosProjectRoot,
    projectName,
    CIO_SDK_APP_DELEGATE_HANDLER_FILENAME
  );

  FileManagement.copyFile(handlerSourcePath, handlerDestPath);

  // Add the file to the Xcode project
  xcodeProject.addSourceFile(
    `${projectName}/${CIO_SDK_APP_DELEGATE_HANDLER_FILENAME}`,
    null,
    group
  );

  let handlerFileContent = FileManagement.readFile(handlerDestPath);

  const disableNotificationRegistration =
    props.pushNotification?.disableNotificationRegistration;
  let snippet = '';
  // unless this property is explicity set to true, push notification
  // registration will be added to the AppDelegate
  if (disableNotificationRegistration !== true) {
    snippet = CIO_REGISTER_PUSHNOTIFICATION_SNIPPET_v2;
  }
  handlerFileContent = replaceCodeByRegex(
    handlerFileContent,
    CIO_REGISTER_PUSH_NOTIFICATION_PLACEHOLDER,
    snippet
  );

  const autoTrackPushEvents =
    props.pushNotification?.autoTrackPushEvents !== false;
  handlerFileContent = replaceCodeByRegex(
    handlerFileContent,
    /\{\{AUTO_TRACK_PUSH_EVENTS\}\}/,
    autoTrackPushEvents.toString()
  );

  const autoFetchDeviceToken =
    props.pushNotification?.autoFetchDeviceToken !== false;
  handlerFileContent = replaceCodeByRegex(
    handlerFileContent,
    /\{\{AUTO_FETCH_DEVICE_TOKEN\}\}/,
    autoFetchDeviceToken.toString()
  );

  const showPushAppInForeground =
    props.pushNotification?.showPushAppInForeground !== false;
  handlerFileContent = replaceCodeByRegex(
    handlerFileContent,
    /\{\{SHOW_PUSH_APP_IN_FOREGROUND\}\}/,
    showPushAppInForeground.toString()
  );

  const appGroupId = props.pushNotification?.appGroupId;
  const appGroupIdBuilderLine = appGroupId
    ? `        .appGroupId(${JSON.stringify(appGroupId)})\n`
    : '';
  handlerFileContent = replaceCodeByRegex(
    handlerFileContent,
    /\{\{APP_GROUP_ID_BUILDER_LINE\}\}/,
    appGroupIdBuilderLine
  );

  // Add auto initialization if sdkConfig is provided
  if (sdkConfig) {
    // Also copy CustomerIOSDKInitializer.swift for auto-initialization
    copyAndConfigureNativeSDKInitializer({
      xcodeProject,
      group,
      iosProjectRoot,
      projectName,
      sdkConfig,
      location,
      geofence,
    });

    // Inject auto initialization call before MessagingPush initialization
    handlerFileContent = handlerFileContent.replace(
      CIO_MESSAGING_PUSH_APP_DELEGATE_INIT_REGEX,
      CIO_NATIVE_SDK_INITIALIZE_SNIPPET + '$1'
    );
  }

  FileManagement.writeFile(handlerDestPath, handlerFileContent);
};

const copyAndConfigureNativeSDKInitializer = ({
  xcodeProject,
  group,
  iosProjectRoot,
  projectName,
  sdkConfig,
  location,
  geofence,
}: {
  xcodeProject: XcodeProject;
  group: string;
  iosProjectRoot: string;
  projectName: string;
  sdkConfig: NativeSDKConfig;
  location?: CustomerIOPluginLocationOptions;
  geofence?: CustomerIOPluginGeofenceOptions;
}) => {
  const geofenceEnabled = geofence?.enabled === true;
  // Geofence implies location: register the location module whenever location or geofence is enabled.
  const locationOptions = {
    enabled: location?.enabled === true || geofenceEnabled,
    trackingMode: sdkConfig?.location?.trackingMode,
  };
  const geofenceOptions = {
    enabled: geofenceEnabled,
    locationMode: sdkConfig?.geofence?.locationMode,
    allowBackgroundDelivery: sdkConfig?.ios?.allowBackgroundDelivery,
  };
  const filename = 'CustomerIOSDKInitializer.swift';
  const sourcePath = path.join(getIosNativeFilesPath(), filename);
  // Add the CustomerIOSDKInitializer.swift file to the same Xcode group as CioSdkAppDelegateHandler
  copyFileToXcode({
    xcodeProject,
    iosProjectRoot,
    projectName,
    sourceFilePath: sourcePath,
    targetFileName: filename,
    transform: (content) =>
      patchNativeSDKInitializer(
        content,
        PLATFORM.IOS,
        sdkConfig,
        locationOptions,
        geofenceOptions
      ),
    customerIOGroup: group,
  });
};

export const withCIOIosSwift = (
  configOuter: ExpoConfig,
  sdkConfig?: NativeSDKConfig,
  props?: CustomerIOPluginOptionsIOS,
  location?: CustomerIOPluginLocationOptions,
  geofence?: CustomerIOPluginGeofenceOptions,
  liveNotificationsEnabled = false,
  usesSceneLifecycle = false
) => {
  // First, copy required swift files to iOS folder and add it to Xcode project
  configOuter = withXcodeProject(configOuter, async (config) => {
    return copyAndConfigureAppDelegateHandler(
      config,
      sdkConfig,
      props,
      location,
      geofence
    );
  });

  // Modify the AppDelegate based on configuration
  if (props?.pushNotification) {
    // With push notifications: delegate to CioSdkAppDelegateHandler for both push and auto-init
    return withAppDelegate(configOuter, async (config) => {
      const projectUsesSceneLifecycle =
        usesSceneLifecycle &&
        hasExpoSceneLifecycle(
          config.modRequest?.platformProjectRoot,
          config.modRequest?.projectName
        );
      if (usesSceneLifecycle && !projectUsesSceneLifecycle) {
        logger.warn(
          'Expo SDK 57+ was detected, but the generated iOS project does not have an Expo SceneDelegate and scene manifest; keeping AppDelegate URL routing'
        );
      }
      warnIfNativeAutoInitializationNeedsSceneReadiness(
        sdkConfig,
        projectUsesSceneLifecycle
      );
      config.modResults.contents = modifyAppDelegateForPushHandler(
        config.modResults.contents,
        props,
        projectUsesSceneLifecycle
      );
      return config;
    });
  } else if (sdkConfig || liveNotificationsEnabled) {
    // Without push notifications: inject auto initialization directly, plus the Live Activity tap
    // route when the feature is on. `CioSdkAppDelegateHandler` is not an option here — it imports
    // the push module, which this configuration does not install — so the tap goes straight to the
    // Live Activities module instead.
    return withAppDelegate(configOuter, async (config) => {
      const projectUsesSceneLifecycle =
        usesSceneLifecycle &&
        hasExpoSceneLifecycle(
          config.modRequest?.platformProjectRoot,
          config.modRequest?.projectName
        );
      if (usesSceneLifecycle && !projectUsesSceneLifecycle) {
        logger.warn(
          'Expo SDK 57+ was detected, but the generated iOS project does not have an Expo SceneDelegate and scene manifest; keeping AppDelegate URL routing'
        );
      }
      warnIfNativeAutoInitializationNeedsSceneReadiness(
        sdkConfig,
        projectUsesSceneLifecycle
      );
      let next = config.modResults.contents;
      if (sdkConfig) {
        next = modifyAppDelegateForNativeSDKInitializer(
          next,
          projectUsesSceneLifecycle
        );
      }
      if (liveNotificationsEnabled) {
        next = modifyAppDelegateForLiveActivityUrl(
          next,
          projectUsesSceneLifecycle
        );
      } else {
        next = removeLiveActivityUrlGuard(next);
      }
      config.modResults.contents = next;
      return config;
    });
  } else {
    return configOuter;
  }
};

/** Remove no-push Live Activity URL handling after an incremental disable. */
export const withCIOIosLiveActivityCleanup = (configOuter: ExpoConfig) => {
  return withAppDelegate(configOuter, async (config) => {
    config.modResults.contents = removeLiveActivityUrlGuard(
      config.modResults.contents
    );
    return config;
  });
};

function warnIfNativeAutoInitializationNeedsSceneReadiness(
  sdkConfig: NativeSDKConfig | undefined,
  usesSceneLifecycle: boolean
): void {
  if (!sdkConfig || !usesSceneLifecycle) return;

  logger.warn(
    'Expo scene projects using native auto-initialization must call CustomerIO.setDeepLinkRoutingReady() after registering the React Native Linking listener'
  );
}

/**
 * Pure string transform: produces the Swift AppDelegate contents wired to delegate to
 * `CioSdkAppDelegateHandler` for both push notifications and (when configured) auto-init.
 * Idempotent — returns `contents` unchanged when the handler is already present.
 */
export function modifyAppDelegateForPushHandler(
  contents: string,
  props: CustomerIOPluginOptionsIOS,
  usesSceneLifecycle = false
): string {
  let next = contents;

  if (APP_DELEGATE_HANDLER_DECLARATION_REGEX.test(maskSwiftNonCode(next))) {
    logger.info(
      'CustomerIO Swift AppDelegate changes already exist. Adding anything newer...'
    );
    // Don't return the file untouched: an AppDelegate integrated by an earlier plugin version has
    // the handler but not the Live Activity tap route, and skipping outright leaves every upgraded
    // app without it. `addOpenURLHandling` is idempotent, so re-running it is safe.
    if (!usesSceneLifecycle) {
      return addOpenURLHandling(next);
    }

    return removeLegacyAppDelegateDeepLinkHandling(
      addSceneRoutingBeforeNativeInitialization(next)
    );
  }

  next = addHandlerPropertyDeclaration(next);
  next = modifyDidFinishLaunchingWithOptions(
    next,
    `  cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)\n\n    `
  );
  next = addDidRegisterForRemoteNotificationsWithDeviceToken(next);
  next = addDidFailToRegisterForRemoteNotificationsWithError(next);
  if (usesSceneLifecycle) {
    next = addSceneRoutingBeforeNativeInitialization(next);
    next = removeLegacyAppDelegateDeepLinkHandling(next);
    if (props.pushNotification?.handleDeeplinkInKilledState === true) {
      logger.warn(
        'handleDeeplinkInKilledState is not applied to Expo SDK 57+ scene projects; ' +
          'scene routing replaces the legacy AppDelegate launch-options workaround'
      );
    }
  } else {
    next = addOpenURLHandling(next);
    if (props.pushNotification?.handleDeeplinkInKilledState === true) {
      next = addHandleDeeplinkInKilledState(next);
    }
  }

  return next;
}

/**
 * Pure string transform: routes opened URLs to the Live Activities module on the no-push path.
 *
 * The push path delegates this to `CioSdkAppDelegateHandler`, but that file imports the push module,
 * which a Live-Notifications-without-push app does not install. Calling the module directly keeps
 * the tap reporting its `opened` metric and returning the customer's deep link either way.
 *
 * Idempotent, and a no-op if the push handler already owns the method.
 */
export function modifyAppDelegateForLiveActivityUrl(
  contents: string,
  usesSceneLifecycle = false
): string {
  if (usesSceneLifecycle) {
    return removeLiveActivityUrlGuard(contents);
  }

  const executableContents = maskSwiftNonCode(contents);
  if (
    executableContents.includes(LIVE_ACTIVITY_URL_CALL) ||
    hasCioOpenUrlHandling(contents)
  ) {
    return contents;
  }

  const next = addSwiftImports(contents, LIVE_ACTIVITY_IMPORTS);

  const methodRegex =
    /func\s+application\s*\(\s*_\s+(app|application)\s*:\s*UIApplication\s*,\s*open\s+url\s*:\s*URL\s*,\s*options\s*:[^)]*\)\s*->\s*Bool\s*{/;
  const match = next.match(methodRegex);

  if (match) {
    const insertAt = (match.index ?? 0) + match[0].length;
    return (
      next.substring(0, insertAt) +
      '\n    // Report a Live Activity tap and route the deep link it carries\n' +
      `    guard let url = ${LIVE_ACTIVITY_URL_CALL}(url) else { return true }\n` +
      next.substring(insertAt)
    );
  }

  const classEndRegex = /^}(\s*$|\s*\/\/)/m;
  const classEndMatch = next.match(classEndRegex);
  if (!classEndMatch) {
    logger.warn('Could not find end of AppDelegate class');
    return next;
  }

  const position = classEndMatch.index ?? 0;
  return (
    next.substring(0, position) +
    '\n  // Report a Live Activity tap and route the deep link it carries\n' +
    '  public override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {\n' +
    `    guard let url = ${LIVE_ACTIVITY_URL_CALL}(url) else { return true }\n` +
    '    return super.application(app, open: url, options: options)\n' +
    '  }\n' +
    next.substring(position)
  );
}

/**
 * Pure string transform: injects the auto-init snippet into the Swift AppDelegate's
 * didFinishLaunchingWithOptions for the no-push path. Idempotent.
 */
export function modifyAppDelegateForNativeSDKInitializer(
  contents: string,
  usesSceneLifecycle = false
): string {
  if (NATIVE_INITIALIZATION_LINE_REGEX.test(maskSwiftNonCode(contents))) {
    logger.info(
      'CustomerIO Swift AppDelegate changes already exist. Skipping...'
    );
    return usesSceneLifecycle
      ? addSceneRoutingBeforeNativeInitialization(contents)
      : contents;
  }

  let next = modifyDidFinishLaunchingWithOptions(
    contents,
    CIO_NATIVE_SDK_INITIALIZE_SNIPPET
  );
  if (usesSceneLifecycle) {
    next = addSceneRoutingBeforeNativeInitialization(next);
  }
  return next;
}

/** Install React Native routing before native Customer.io initialization in a scene host. */
function addSceneRoutingBeforeNativeInitialization(contents: string): string {
  if (hasExecutableSceneRouting(contents)) {
    return contents;
  }

  const executableContents = maskSwiftNonCode(contents);
  const initializationMatch =
    executableContents.match(PUSH_INITIALIZATION_LINE_REGEX) ??
    executableContents.match(NATIVE_INITIALIZATION_LINE_REGEX);
  if (!initializationMatch || initializationMatch.index === undefined) {
    throw new Error(
      logger.format(
        'Could not install Expo scene deep-link routing because the Customer.io initialization call was not added to AppDelegate. Preserve Expo\'s super.application(application, didFinishLaunchingWithOptions: launchOptions) return shape or integrate Customer.io initialization manually.'
      )
    );
  }

  const lineStart = contents.lastIndexOf('\n', initializationMatch.index) + 1;
  const nextLine = contents.indexOf('\n', initializationMatch.index);
  const lineEnd = nextLine < 0 ? contents.length : nextLine;
  const initializationLine = contents.slice(lineStart, lineEnd);
  const indentation = initializationLine.match(/^[ \t]*/)?.[0] ?? '';
  const withSceneRouting = `${contents.slice(
    0,
    lineStart
  )}${indentation}${CONFIGURE_SCENE_ROUTING_CALL}\n${contents.slice(
    lineStart
  )}`;
  return addSwiftImports(withSceneRouting, [REACT_NATIVE_IMPORT]);
}

function hasExecutableSceneRouting(contents: string): boolean {
  return CONFIGURE_SCENE_ROUTING_LINE_REGEX.test(maskSwiftNonCode(contents));
}

/**
 * Check if a method exists in the AppDelegate content
 * @param content The AppDelegate content
 * @param methodSignature The method signature to check for
 * @returns true if the method exists, false otherwise
 */
const methodExistsInAppDelegate = (
  content: string,
  methodSignature: string
): boolean => {
  return content.includes(methodSignature);
};

/**
 * Add handler property declaration to the AppDelegate class
 * This adds the line: let cioSdkHandler = CioSdkAppDelegateHandler()
 * to the AppDelegate class
 */
const addHandlerPropertyDeclaration = (content: string): string => {
  // Look for the AppDelegate class declaration
  const classDeclarationRegex = /class\s+AppDelegate\s*:\s*.*\s*{/;
  const match = content.match(classDeclarationRegex);

  if (!match) {
    logger.warn('Could not find AppDelegate class declaration');
    return content;
  }

  const position = (match.index ?? 0) + match[0].length;
  return (
    content.substring(0, position) +
    `\n  let cioSdkHandler = ${CIO_SDK_APP_DELEGATE_HANDLER_CLASS}()\n` +
    content.substring(position)
  );
};

/**
 * Modify didFinishLaunchingWithOptions to inject Customer.io code
 * Injects the provided code (either handler call or auto initialization) before the return statement
 */
const modifyDidFinishLaunchingWithOptions = (
  content: string,
  codeToInject: string
): string => {
  // Find the return statement in didFinishLaunchingWithOptions
  // Always look for launchOptions since modifiedLaunchOptions is only set later
  const returnStatementRegex =
    /return\s+super\.application\s*\(\s*application\s*,\s*didFinishLaunchingWithOptions\s*:\s*launchOptions\s*\)/;

  const returnStatementMatch = content.match(returnStatementRegex);

  if (!returnStatementMatch) {
    logger.warn(
      'Could not find return statement with super.application in didFinishLaunchingWithOptions'
    );
    return content;
  }

  // Inject Customer.io code before the return statement
  const insertPosition = returnStatementMatch.index ?? 0;

  return (
    content.substring(0, insertPosition) +
    codeToInject +
    content.substring(insertPosition)
  );
};

/**
 * Add or modify didRegisterForRemoteNotificationsWithDeviceToken implementation
 * If the method already exists, it adds the handler call to the existing method
 * If the method doesn't exist, it adds a new method implementation
 */
/**
 * Route a tapped Live Activity through the Customer.io handler before the app's own deep-link
 * handling runs.
 *
 * The handler reports the `opened` metric and returns the URL to actually open: for a Customer.io
 * widget URL that's the customer's deep link, and any other URL comes back unchanged. The injected
 * `guard let url = ...` shadows the parameter, so the rest of an existing implementation keeps
 * working verbatim against the routed URL; `nil` means the activity carried no deep link and there
 * is nothing left to open.
 */
const CIO_OPEN_URL_MARKER = 'cioSdkHandler.application(';
/**
 * Both are required to compile the injected call.
 *
 * `CustomerIO` itself is declared in `CioInternalCommon`, which `CioDataPipelines` re-exports with
 * `@_exported`. `CioLiveActivities` only adds the `liveActivities` extension and imports
 * `CioInternalCommon` plainly, so importing it alone leaves `CustomerIO` out of scope. The push-path
 * handler imports the same pair for this reason.
 */
const LIVE_ACTIVITY_IMPORTS = [
  'import CioDataPipelines',
  'import CioLiveActivities',
];
const CONDITIONAL_LIVE_ACTIVITY_IMPORT = `#if canImport(CioLiveActivities)
import CioLiveActivities
#endif`;
const LIVE_ACTIVITY_URL_CALL = 'CustomerIO.liveActivities.handleWidgetUrl';

/**
 * Whether the push path already owns `application(_:open:options:)`.
 *
 * Both parameter spellings have to be checked: Expo's template names it `_ app`, other templates use
 * `_ application`, and the injected marker carries whichever one the AppDelegate had. Shared by both
 * injectors so they can't disagree — checking only one spelling lets the other path add a second
 * guard inside the same method on a re-prebuild.
 */
function hasCioOpenUrlHandling(contents: string): boolean {
  const executableContents = maskSwiftNonCode(contents);
  return (
    executableContents.includes(`${CIO_OPEN_URL_MARKER}app, open:`) ||
    executableContents.includes(`${CIO_OPEN_URL_MARKER}application, open:`)
  );
}

/**
 * The whole method {@link modifyAppDelegateForLiveActivityUrl} appends when the template has no
 * `application(_:open:options:)` of its own. Removing the entire method — rather than just its guard —
 * puts the file back as it was, so the push injector takes its normal "no implementation to wrap"
 * path instead of grafting onto a method the Live Activity injector invented.
 */
const LIVE_ACTIVITY_URL_METHOD_REGEX =
  /\n[ \t]*\/\/ Report a Live Activity tap and route the deep link it carries\n[ \t]*public override func application\(_ app: UIApplication, open url: URL, options: \[UIApplication\.OpenURLOptionsKey: Any\] = \[:\]\) -> Bool \{\n[ \t]*guard let url = CustomerIO\.liveActivities\.handleWidgetUrl\(url\) else \{ return true \}\n[ \t]*return super\.application\(app, open: url, options: options\)\n[ \t]*\}\n/g;

/**
 * The comment + guard pair {@link modifyAppDelegateForLiveActivityUrl} injects into a method that
 * already existed.
 *
 * Both patterns are kept in sync with the injector by the round-trip test rather than by shared
 * constants, because a removal has to match the emitted text exactly, indentation included.
 */
const LIVE_ACTIVITY_URL_GUARD_REGEX =
  /\n[ \t]*\/\/ Report a Live Activity tap and route the deep link it carries\n[ \t]*guard let url = CustomerIO\.liveActivities\.handleWidgetUrl\(url\) else \{ return true \}/g;

/**
 * Strips the no-push Live Activity guard so the push handler can take over.
 *
 * An app can be prebuilt with Live Notifications and no push, which installs the direct call, and
 * later add a push provider. `CioSdkAppDelegateHandler` routes activity URLs too, so leaving the
 * direct call in place would report the same tap twice — and the push guard is inserted into the very
 * method that already holds it, whether that method came from Expo's template or was created by the
 * Live Activity injector.
 *
 * If the generated route was the last known use, makes the Live Activities import conditional.
 * That keeps a host-owned import/use intact when the module remains installed, while allowing an
 * incremental prebuild that removes the module to compile. We cannot safely delete an import from a
 * host-owned AppDelegate because another host customization may still need it.
 */
function removeLiveActivityUrlGuard(contents: string): string {
  if (!maskSwiftNonCode(contents).includes(LIVE_ACTIVITY_URL_CALL)) {
    return contents;
  }
  // Whole-method shape first: it contains the guard shape's text, so the narrower pattern would
  // otherwise strip the guard and leave an empty method behind.
  const withoutGeneratedMethod = removeExecutableLiveActivityMatches(
    contents,
    LIVE_ACTIVITY_URL_METHOD_REGEX
  );
  const next = removeExecutableLiveActivityMatches(
    withoutGeneratedMethod,
    LIVE_ACTIVITY_URL_GUARD_REGEX
  );

  if (next === contents) {
    return contents;
  }

  const executableNext = maskSwiftNonCode(next);
  if (
    executableNext.includes(LIVE_ACTIVITY_URL_CALL) ||
    executableNext.includes(CONDITIONAL_LIVE_ACTIVITY_IMPORT)
  ) {
    return next;
  }

  const liveActivityImport = executableNext.match(/^import CioLiveActivities$/m);
  if (!liveActivityImport || liveActivityImport.index === undefined) {
    return next;
  }

  const importStart = liveActivityImport.index;
  return `${next.slice(
    0,
    importStart
  )}${CONDITIONAL_LIVE_ACTIVITY_IMPORT}${next.slice(
    importStart + liveActivityImport[0].length
  )}`;
}

function removeExecutableLiveActivityMatches(
  contents: string,
  pattern: RegExp
): string {
  const executableContents = maskSwiftNonCode(contents);
  return contents.replace(pattern, (match: string, offset: number) => {
    const executableMatch = executableContents.slice(
      offset,
      offset + match.length
    );
    return executableMatch.includes(LIVE_ACTIVITY_URL_CALL) ? '' : match;
  });
}

const APP_DELEGATE_PUSH_OPEN_URL_METHOD_REGEX =
  /\n[ \t]*\/\/ Report a Live Activity tap and route the deep link it carries\n[ \t]*public override func application\(_ (?:app|application): UIApplication, open url: URL, options: \[UIApplication\.OpenURLOptionsKey: Any\] = \[:\]\) -> Bool \{\n[ \t]*\/\/ Call CustomerIO SDK handler\n[ \t]*guard let url = cioSdkHandler\.application\((?:app|application), open: url, options: options\) else \{ return true \}\n[ \t]*return super\.application\((?:app|application), open: url, options: options\)\n[ \t]*\}\n/g;

const APP_DELEGATE_PUSH_OPEN_URL_GUARD_REGEX =
  /\n[ \t]*\/\/ Call CustomerIO SDK handler\n[ \t]*guard let url = cioSdkHandler\.application\((?:app|application), open: url, options: options\) else \{ return true \}/g;

const KILLED_STATE_DEEP_LINK_BLOCK_REGEX =
  /\n?[ \t]*\/\/ Deep link workaround for app killed state start[\s\S]*?\/\/ Deep link workaround for app killed state ends\n?/g;

/**
 * Removes AppDelegate URL ownership generated by SDK 53–57 when an incremental prebuild upgrades
 * the project to Expo's scene lifecycle. Push registration methods stay in AppDelegate; only URL
 * delivery moves to SceneDelegate and the React Native router.
 */
function removeLegacyAppDelegateDeepLinkHandling(contents: string): string {
  const hadKilledStateBlock = contents.includes(
    'Deep link workaround for app killed state start'
  );
  let next = contents
    .replace(KILLED_STATE_DEEP_LINK_BLOCK_REGEX, '\n')
    .replace(APP_DELEGATE_PUSH_OPEN_URL_METHOD_REGEX, '')
    .replace(APP_DELEGATE_PUSH_OPEN_URL_GUARD_REGEX, '');

  if (hadKilledStateBlock) {
    next = next
      .replace(/launchOptions:\s*modifiedLaunchOptions/g, 'launchOptions: launchOptions')
      .replace(
        /didFinishLaunchingWithOptions:\s*modifiedLaunchOptions/g,
        'didFinishLaunchingWithOptions: launchOptions'
      );
  }
  return removeLiveActivityUrlGuard(next);
}

const addOpenURLHandling = (content: string): string => {
  // Already wired — by this run or by an earlier prebuild. Injecting again would duplicate the guard
  // inside the same method.
  if (hasCioOpenUrlHandling(content)) {
    return content;
  }

  // The push handler supersedes the no-push Live Activity call, so drop that one first — otherwise
  // enabling push on an already-prebuilt project stacks a second guard in the same method.
  content = removeLiveActivityUrlGuard(content);

  // Match either parameter spelling (`_ app` in Expo's template, `_ application` elsewhere) across
  // the multi-line signature Expo generates.
  const methodRegex =
    /func\s+application\s*\(\s*_\s+(app|application)\s*:\s*UIApplication\s*,\s*open\s+url\s*:\s*URL\s*,\s*options\s*:[^)]*\)\s*->\s*Bool\s*{/;
  const match = content.match(methodRegex);

  if (match) {
    const appParam = match[1];
    const insertAt = (match.index ?? 0) + match[0].length;
    return (
      content.substring(0, insertAt) +
      '\n    // Call CustomerIO SDK handler\n' +
      `    guard let url = cioSdkHandler.application(${appParam}, open: url, options: options) else { return true }\n` +
      content.substring(insertAt)
    );
  }

  // No implementation to wrap, so add one that only reports and forwards to super.
  const classEndRegex = /^}(\s*$|\s*\/\/)/m;
  const classEndMatch = content.match(classEndRegex);
  if (!classEndMatch) {
    logger.warn('Could not find end of AppDelegate class');
    return content;
  }

  const position = classEndMatch.index ?? 0;
  return (
    content.substring(0, position) +
    '\n  // Report a Live Activity tap and route the deep link it carries\n' +
    '  public override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {\n' +
    '    // Call CustomerIO SDK handler\n' +
    '    guard let url = cioSdkHandler.application(app, open: url, options: options) else { return true }\n' +
    '    return super.application(app, open: url, options: options)\n' +
    '  }\n' +
    content.substring(position)
  );
};

const addDidRegisterForRemoteNotificationsWithDeviceToken = (
  content: string
): string => {
  const methodSignature =
    'func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken:';

  // Check if method already exists
  if (methodExistsInAppDelegate(content, methodSignature)) {
    // Method exists, modify it to call our handler
    const methodRegex =
      /func\s+application\s*\(\s*_\s+application\s*:\s*UIApplication\s*,\s*didRegisterForRemoteNotificationsWithDeviceToken\s+deviceToken\s*:\s*Data\s*\)\s*{[\s\S]*?}/;
    const match = content.match(methodRegex);

    if (match) {
      // Add our handler call to the existing method
      const methodContent = match[0];
      const openBraceIndex = methodContent.indexOf('{') + 1;
      const modifiedMethod =
        methodContent.substring(0, openBraceIndex) +
        '\n        // Call CustomerIO SDK handler\n' +
        '        cioSdkHandler.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)\n' +
        methodContent.substring(openBraceIndex);

      return content.replace(methodRegex, modifiedMethod);
    }

    return content;
  } else {
    // Method doesn't exist, add it inside the AppDelegate class
    // Find the end of the AppDelegate class
    const classEndRegex = /^}(\s*$|\s*\/\/)/m;
    const classEndMatch = content.match(classEndRegex);

    if (!classEndMatch) {
      logger.warn('Could not find end of AppDelegate class');
      return content;
    }

    // Insert the method inside the class
    const position = classEndMatch.index ?? 0;
    return (
      content.substring(0, position) +
      '\n  // Handle device token registration\n' +
      '  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n' +
      '    // Call CustomerIO SDK handler\n' +
      '    cioSdkHandler.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)\n' +
      '    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)\n' +
      '  }\n' +
      content.substring(position)
    );
  }
};

/**
 * Add or modify didFailToRegisterForRemoteNotificationsWithError implementation
 * If the method already exists, it adds the handler call to the existing method
 * If the method doesn't exist, it adds a new method implementation
 */
const addDidFailToRegisterForRemoteNotificationsWithError = (
  content: string
): string => {
  const methodSignature =
    'func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error:';

  // Check if method already exists
  if (methodExistsInAppDelegate(content, methodSignature)) {
    // Method exists, modify it to call our handler
    const methodRegex =
      /func\s+application\s*\(\s*_\s+application\s*:\s*UIApplication\s*,\s*didFailToRegisterForRemoteNotificationsWithError\s+error\s*:\s*Error\s*\)\s*{[\s\S]*?}/;
    const match = content.match(methodRegex);

    if (match) {
      // Add our handler call to the existing method
      const methodContent = match[0];
      const openBraceIndex = methodContent.indexOf('{') + 1;
      const modifiedMethod =
        methodContent.substring(0, openBraceIndex) +
        '\n        // Call CustomerIO SDK handler\n' +
        '        cioSdkHandler.application(application, didFailToRegisterForRemoteNotificationsWithError: error)\n' +
        methodContent.substring(openBraceIndex);

      return content.replace(methodRegex, modifiedMethod);
    }

    return content;
  } else {
    // Method doesn't exist, add it inside the AppDelegate class
    // Find the end of the AppDelegate class
    const classEndRegex = /^}(\s*$|\s*\/\/)/m;
    const classEndMatch = content.match(classEndRegex);

    if (!classEndMatch) {
      logger.warn('Could not find end of AppDelegate class');
      return content;
    }

    // Insert the method inside the class
    const position = classEndMatch.index ?? 0;
    return (
      content.substring(0, position) +
      '\n  // Handle remote notification registration errors\n' +
      '  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {\n' +
      '    // Call CustomerIO SDK handler\n' +
      '    cioSdkHandler.application(application, didFailToRegisterForRemoteNotificationsWithError: error)\n' +
      '    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)\n' +
      '  }\n' +
      content.substring(position)
    );
  }
};

/**
 * Add deep link handling for killed state
 *
 * On modern Expo Swift templates, RN is bootstrapped by `factory.startReactNative(...)`
 * inside an `#if os(iOS) || os(tvOS)` guard, *before* the trailing `return super.application(...)`.
 * The deep-link block must run before that call so `modifiedLaunchOptions` flows into RN's
 * initial launchOptions; otherwise the workaround is a no-op.
 *
 * For older templates (no `factory.startReactNative` — `super.application(...)` is what
 * starts RN), the snippet is injected before the return statement as before.
 */
const addHandleDeeplinkInKilledState = (content: string): string => {
  const deepLinkMarker = 'Deep link workaround for app killed state start';
  if (content.includes(deepLinkMarker)) {
    return content;
  }

  const returnStatementRegex =
    /return\s+super\.application\s*\(\s*application\s*,\s*didFinishLaunchingWithOptions\s*:\s*launchOptions\s*\)/;
  const modifiedReturnStatement =
    'return super.application(application, didFinishLaunchingWithOptions: modifiedLaunchOptions)';

  const factoryStartRegex =
    /(\s*)#if\s+os\(iOS\)\s*\|\|\s*os\(tvOS\)([\s\S]*?factory\.startReactNative\s*\([\s\S]*?launchOptions:\s*)launchOptions(\s*\)[\s\S]*?#endif)/;

  if (factoryStartRegex.test(content)) {
    let result = content.replace(
      factoryStartRegex,
      `\n${CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SWIFT_SNIPPET}\n#if os(iOS) || os(tvOS)$2modifiedLaunchOptions$3`
    );
    if (returnStatementRegex.test(result)) {
      result = result.replace(returnStatementRegex, modifiedReturnStatement);
    }
    return result;
  }

  if (!returnStatementRegex.test(content)) {
    logger.warn('Could not find return statement with launchOptions');
    return content;
  }
  const replacementCode =
    CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SWIFT_SNIPPET +
    '\n\n    ' +
    modifiedReturnStatement;
  return content.replace(returnStatementRegex, replacementCode);
};
