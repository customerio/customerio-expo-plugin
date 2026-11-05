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
  enclosingConditionalStart,
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
const CONFIGURE_ACKNOWLEDGED_SCENE_ROUTING_CALL =
  'NativeCustomerIO.configureAcknowledgedSceneDeepLinkRouting()';
const CONFIGURE_SCENE_ROUTING_LINE_REGEX =
  /^[ \t]*NativeCustomerIO\.configureExpoSceneDeepLinkRouting\(\)[ \t]*$/m;
const CONFIGURE_ACKNOWLEDGED_SCENE_ROUTING_LINE_REGEX =
  /^[ \t]*NativeCustomerIO\.configureAcknowledgedSceneDeepLinkRouting\(\)[ \t]*$/m;
const PUSH_INITIALIZATION_LINE_REGEX =
  /^[ \t]*(?:_[ \t]*=[ \t]*)?cioSdkHandler\.application\([ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*,[ \t]*didFinishLaunchingWithOptions:[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*\)[ \t]*;?[ \t]*$/m;
const NATIVE_INITIALIZATION_LINE_REGEX =
  /^[ \t]*(?:_[ \t]*=[ \t]*)?CustomerIOSDKInitializer\.initialize\(\)[ \t]*;?[ \t]*$/m;
const APP_DELEGATE_HANDLER_DECLARATION_REGEX =
  /^[ \t]*(?:(?:private|fileprivate|internal|public|open|final|lazy)[ \t]+)*(?:let|var)[ \t]+cioSdkHandler(?:[ \t]*:[ \t]*CioSdkAppDelegateHandler)?[ \t]*=[ \t]*(?:CioSdkAppDelegateHandler|\.init)\(\)/m;

/**
 * Copy and configure the CioSdkAppDelegateHandler.swift file
 */
const copyAndConfigureAppDelegateHandler = (
  config: ExportedConfigWithProps<XcodeProject>,
  sdkConfig?: NativeSDKConfig,
  props?: CustomerIOPluginOptionsIOS,
  location?: CustomerIOPluginLocationOptions,
  geofence?: CustomerIOPluginGeofenceOptions,
  backgroundPushEnabled = false
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
      backgroundPushEnabled,
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
  backgroundPushEnabled,
}: {
  xcodeProject: XcodeProject;
  group: string;
  iosProjectRoot: string;
  projectName: string;
  sdkConfig: NativeSDKConfig | undefined;
  props: CustomerIOPluginOptionsIOS;
  location?: CustomerIOPluginLocationOptions;
  geofence?: CustomerIOPluginGeofenceOptions;
  backgroundPushEnabled: boolean;
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
  }

  FileManagement.writeFile(
    handlerDestPath,
    patchPushAppDelegateHandler(FileManagement.readFile(handlerDestPath), props, {
      autoInitialize: sdkConfig !== undefined,
      backgroundPush: backgroundPushEnabled,
    })
  );
};

/**
 * Pure string transform: fills in the `CioSdkAppDelegateHandler.swift` template (APN or FCM) from
 * the push options.
 */
export function patchPushAppDelegateHandler(
  template: string,
  props: CustomerIOPluginOptionsIOS,
  {
    autoInitialize,
    backgroundPush = false,
  }: { autoInitialize: boolean; backgroundPush?: boolean }
): string {
  let handlerFileContent = template;

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

  if (autoInitialize) {
    // Inject auto initialization call before MessagingPush initialization
    handlerFileContent = handlerFileContent.replace(
      CIO_MESSAGING_PUSH_APP_DELEGATE_INIT_REGEX,
      CIO_NATIVE_SDK_INITIALIZE_SNIPPET + '$1'
    );
  }

  if (backgroundPush) {
    handlerFileContent = addSwiftImports(
      handlerFileContent.replace(
        BACKGROUND_PUSH_HANDLER_PLACEHOLDER,
        () => BACKGROUND_PUSH_HANDLER_METHOD
      ),
      [REACT_NATIVE_IMPORT]
    );
  } else {
    // Drop the placeholder's line so apps that don't opt in get the same file as before.
    handlerFileContent = handlerFileContent.replace(
      new RegExp(`\\n${BACKGROUND_PUSH_HANDLER_PLACEHOLDER.source}\\n`),
      '\n'
    );
  }

  return handlerFileContent;
}

const BACKGROUND_PUSH_HANDLER_PLACEHOLDER = /\{\{BACKGROUND_PUSH_HANDLER\}\}/;

/**
 * The generated AppDelegate calls this first for every remote notification (see
 * {@link addBackgroundPushHandling}). The React Native SDK reads the push with the native SDK, which
 * records Delivered, hands the data to the handler set with
 * `CustomerIO.pushMessaging.setBackgroundPushHandler` and calls `completionHandler` once, when the
 * handler settles or after 25 seconds. For any other push it returns false without calling it, so the
 * AppDelegate passes the push on.
 */
const BACKGROUND_PUSH_HANDLER_METHOD = `
  /// Hands a Customer.io silent push to the React Native SDK, which calls \`completionHandler\` once.
  /// Returns false, without calling \`completionHandler\`, for every other push.
  public func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) -> Bool {
    return NativeMessagingPush.handleBackgroundPush(userInfo: userInfo, completionHandler: completionHandler)
  }`;

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
  usesSceneLifecycle = false,
  backgroundPushEnabled = false
) => {
  const acknowledgedRouting = props?.acknowledgedDeepLinkRouting === true;

  // First, copy required swift files to iOS folder and add it to Xcode project
  configOuter = withXcodeProject(configOuter, async (config) => {
    return copyAndConfigureAppDelegateHandler(
      config,
      sdkConfig,
      props,
      location,
      geofence,
      backgroundPushEnabled
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
          'Expo SDK 58+ was detected, but the generated iOS project does not have an Expo SceneDelegate and scene manifest; keeping AppDelegate URL routing'
        );
      }
      logSceneDeepLinkRoutingReadiness(
        sdkConfig,
        projectUsesSceneLifecycle,
        acknowledgedRouting
      );
      config.modResults.contents = modifyAppDelegateForPushHandler(
        config.modResults.contents,
        props,
        projectUsesSceneLifecycle,
        backgroundPushEnabled
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
          'Expo SDK 58+ was detected, but the generated iOS project does not have an Expo SceneDelegate and scene manifest; keeping AppDelegate URL routing'
        );
      }
      // Without sdkConfig this path writes no scene routing.
      if (sdkConfig) {
        logSceneDeepLinkRoutingReadiness(
          sdkConfig,
          projectUsesSceneLifecycle,
          acknowledgedRouting
        );
      }
      let next = config.modResults.contents;
      if (sdkConfig) {
        next = modifyAppDelegateForNativeSDKInitializer(
          next,
          projectUsesSceneLifecycle,
          acknowledgedRouting
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

function logSceneDeepLinkRoutingReadiness(
  sdkConfig: NativeSDKConfig | undefined,
  usesSceneLifecycle: boolean,
  acknowledgedRouting: boolean
): void {
  if (!usesSceneLifecycle) return;

  if (acknowledgedRouting) {
    logger.info(
      sdkConfig
        ? 'Expo scene projects using acknowledged deep-link routing with native auto-initialization must register CustomerIO.setDeepLinkHandler when the app starts'
        : 'Expo scene projects using acknowledged deep-link routing must register CustomerIO.setDeepLinkHandler before calling CustomerIO.initialize'
    );
    return;
  }
  if (!sdkConfig) return;

  logger.info(
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
  usesSceneLifecycle = false,
  backgroundPushEnabled = false
): string {
  const next = modifyAppDelegateForPushHandlerWithoutBackgroundPush(
    contents,
    props,
    usesSceneLifecycle
  );
  // Applied on every run, including over an AppDelegate an earlier prebuild already integrated, so
  // turning the option on or off takes effect without `--clean`.
  return backgroundPushEnabled
    ? addBackgroundPushHandling(next)
    : removeBackgroundPushHandling(next);
}

function modifyAppDelegateForPushHandlerWithoutBackgroundPush(
  contents: string,
  props: CustomerIOPluginOptionsIOS,
  usesSceneLifecycle: boolean
): string {
  let next = contents;
  const acknowledgedRouting = props.acknowledgedDeepLinkRouting === true;

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
      addSceneRoutingBeforeNativeInitialization(next, acknowledgedRouting)
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
    next = addSceneRoutingBeforeNativeInitialization(
      next,
      acknowledgedRouting
    );
    next = removeLegacyAppDelegateDeepLinkHandling(next);
    if (props.pushNotification?.handleDeeplinkInKilledState === true) {
      logger.warn(
        'handleDeeplinkInKilledState is not applied to Expo SDK 58+ scene projects; ' +
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

  contents = enableLiveActivityImport(contents);
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
  usesSceneLifecycle = false,
  acknowledgedRouting = false
): string {
  if (NATIVE_INITIALIZATION_LINE_REGEX.test(maskSwiftNonCode(contents))) {
    logger.info(
      'CustomerIO Swift AppDelegate changes already exist. Skipping...'
    );
    return usesSceneLifecycle
      ? addSceneRoutingBeforeNativeInitialization(
          contents,
          acknowledgedRouting
        )
      : contents;
  }

  let next = modifyDidFinishLaunchingWithOptions(
    contents,
    CIO_NATIVE_SDK_INITIALIZE_SNIPPET
  );
  if (usesSceneLifecycle) {
    next = addSceneRoutingBeforeNativeInitialization(
      next,
      acknowledgedRouting
    );
  }
  return next;
}

/** Install React Native routing before native Customer.io initialization in a scene host. */
function addSceneRoutingBeforeNativeInitialization(
  contents: string,
  acknowledgedRouting = false
): string {
  const [
    routingCall,
    routingLineRegex,
    otherRoutingCall,
    otherRoutingLineRegex,
  ] =
    acknowledgedRouting
      ? [
          CONFIGURE_ACKNOWLEDGED_SCENE_ROUTING_CALL,
          CONFIGURE_ACKNOWLEDGED_SCENE_ROUTING_LINE_REGEX,
          CONFIGURE_SCENE_ROUTING_CALL,
          CONFIGURE_SCENE_ROUTING_LINE_REGEX,
        ]
      : [
          CONFIGURE_SCENE_ROUTING_CALL,
          CONFIGURE_SCENE_ROUTING_LINE_REGEX,
          CONFIGURE_ACKNOWLEDGED_SCENE_ROUTING_CALL,
          CONFIGURE_ACKNOWLEDGED_SCENE_ROUTING_LINE_REGEX,
        ];
  if (hasExecutableLine(contents, routingLineRegex)) {
    return contents;
  }

  // Switching modes on a non-clean prebuild: swap the generated call in place.
  const otherRoutingMatch = maskSwiftNonCode(contents).match(
    otherRoutingLineRegex
  );
  if (otherRoutingMatch && otherRoutingMatch.index !== undefined) {
    const callStart =
      otherRoutingMatch.index + otherRoutingMatch[0].indexOf(otherRoutingCall);
    return `${contents.slice(0, callStart)}${routingCall}${contents.slice(
      callStart + otherRoutingCall.length
    )}`;
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
  )}${indentation}${routingCall}\n${contents.slice(
    lineStart
  )}`;
  return addSwiftImports(withSceneRouting, [REACT_NATIVE_IMPORT]);
}

function hasExecutableLine(contents: string, lineRegex: RegExp): boolean {
  return lineRegex.test(maskSwiftNonCode(contents));
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
  /\n[ \t]*\/\/ Report a Live Activity tap and route the deep link it carries\n[ \t]*guard let url = CustomerIO\.liveActivities\.handleWidgetUrl\(url\) else \{ return true \}\n/g;

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
    return hasConditionalLiveActivityImport(contents)
      ? disableLiveActivityImport(contents)
      : contents;
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
  if (executableNext.includes(LIVE_ACTIVITY_URL_CALL)) {
    return next;
  }

  return disableLiveActivityImport(next);
}

type SourceMatch = { index: number; length: number };

function conditionalLiveActivityImportMatch(
  contents: string
): SourceMatch | undefined {
  const match = maskSwiftNonCode(contents).match(
    /#if canImport\(CioLiveActivities\)\nimport CioLiveActivities\n#endif/
  );
  return match?.index === undefined
    ? undefined
    : { index: match.index, length: match[0].length };
}

function hasConditionalLiveActivityImport(contents: string): boolean {
  return conditionalLiveActivityImportMatch(contents) !== undefined;
}

function unconditionalLiveActivityImportMatch(
  contents: string
): SourceMatch | undefined {
  const executableContents = maskSwiftNonCode(contents);
  for (const match of executableContents.matchAll(/^import CioLiveActivities$/gm)) {
    if (match.index === undefined) continue;
    if (
      enclosingConditionalStart(executableContents, match.index) === undefined
    ) {
      return { index: match.index, length: match[0].length };
    }
  }
  return undefined;
}

/** Restore the generated import before adding an unconditional Live Activities call. */
function enableLiveActivityImport(contents: string): string {
  const conditionalImport = conditionalLiveActivityImportMatch(contents);
  if (!conditionalImport) return contents;

  const unconditionalImport = unconditionalLiveActivityImportMatch(contents);
  const replacement = unconditionalImport ? '' : 'import CioLiveActivities';
  return `${contents.slice(0, conditionalImport.index)}${replacement}${contents.slice(
    conditionalImport.index + conditionalImport.length
  )}`;
}

/** Keep a generated import compilable after the Live Activities subspec is removed. */
function disableLiveActivityImport(contents: string): string {
  const conditionalImport = conditionalLiveActivityImportMatch(contents);
  const unconditionalImport = unconditionalLiveActivityImportMatch(contents);
  if (!unconditionalImport) return contents;

  const replacement = conditionalImport
    ? ''
    : CONDITIONAL_LIVE_ACTIVITY_IMPORT;
  return `${contents.slice(0, unconditionalImport.index)}${replacement}${contents.slice(
    unconditionalImport.index + unconditionalImport.length
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

/**
 * `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)` in executable code, with any
 * parameter names and line breaks. Group 1 is the application parameter, 2 the user info and 3 the
 * completion handler.
 */
const DID_RECEIVE_REMOTE_NOTIFICATION_METHOD_REGEX =
  /func\s+application\s*\(\s*_\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*UIApplication\s*,\s*didReceiveRemoteNotification\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\[\s*AnyHashable\s*:\s*Any\s*\]\s*,\s*fetchCompletionHandler\s+([A-Za-z_][A-Za-z0-9_]*)\s*:[^{]*\{/;

const BACKGROUND_PUSH_CALL_REGEX =
  /cioSdkHandler\.application\([A-Za-z_][A-Za-z0-9_]*,\s*didReceiveRemoteNotification:/;

const backgroundPushGuard = (
  application: string,
  userInfo: string,
  completionHandler: string
) =>
  `if cioSdkHandler.application(${application}, didReceiveRemoteNotification: ${userInfo}, fetchCompletionHandler: ${completionHandler}) { return }`;

/**
 * The whole method {@link addBackgroundPushHandling} appends when the AppDelegate has none of its
 * own. Kept in sync with the emitted text by the round-trip test.
 */
const BACKGROUND_PUSH_METHOD_REGEX =
  /\n[ \t]*\/\/ Hand Customer\.io silent pushes to the Customer\.io SDK and every other push to Expo\n[ \t]*public override func application\(_ application: UIApplication, didReceiveRemoteNotification userInfo: \[AnyHashable: Any\], fetchCompletionHandler completionHandler: @escaping \(UIBackgroundFetchResult\) -> Void\) \{\n[ \t]*\/\/ Call CustomerIO SDK handler\n[ \t]*if cioSdkHandler\.application\(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler\) \{ return \}\n[ \t]*super\.application\(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler\)\n[ \t]*\}\n/g;

/** The comment + guard pair {@link addBackgroundPushHandling} injects into a method that already existed. */
const BACKGROUND_PUSH_GUARD_REGEX =
  /\n[ \t]*\/\/ Call CustomerIO SDK handler\n[ \t]*if cioSdkHandler\.application\([A-Za-z_][A-Za-z0-9_]*, didReceiveRemoteNotification: [A-Za-z_][A-Za-z0-9_]*, fetchCompletionHandler: [A-Za-z_][A-Za-z0-9_]*\) \{ return \}/g;

/**
 * Offsets of the `{` and matching `}` of `class AppDelegate` in masked source, where comments and
 * strings are blanked so their braces don't count.
 */
function appDelegateClassBody(
  executableContents: string
): { open: number; close: number } | undefined {
  const declaration = executableContents.match(/\bclass\s+AppDelegate\b[^{]*\{/);
  if (!declaration || declaration.index === undefined) return undefined;
  const open = declaration.index + declaration[0].length - 1;
  let depth = 0;
  for (let index = open; index < executableContents.length; index += 1) {
    if (executableContents[index] === '{') {
      depth += 1;
    } else if (executableContents[index] === '}') {
      depth -= 1;
      if (depth === 0) return { open, close: index };
    }
  }
  return undefined;
}

/**
 * Pure string transform: routes `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)`
 * through `CioSdkAppDelegateHandler` first.
 *
 * Expo's `ExpoAppDelegate` is the app delegate, not the SDK's `CioAppDelegateWrapper`, so nothing
 * else hands silent pushes to the SDK. The handler returns true when it took a Customer.io silent
 * push, and it then owns the completion handler. Any other push goes to `super`, which runs Expo's
 * app delegate subscribers (expo-notifications and others) and calls the completion handler once.
 *
 * Idempotent. An existing implementation gets the guard as its first statement and otherwise runs
 * unchanged.
 */
export function addBackgroundPushHandling(content: string): string {
  const executableContents = maskSwiftNonCode(content);
  if (BACKGROUND_PUSH_CALL_REGEX.test(executableContents)) {
    return content;
  }

  const body = appDelegateClassBody(executableContents);
  if (!body) {
    logger.warn('Could not find the AppDelegate class, so Customer.io silent pushes are not routed');
    return content;
  }

  // Only the AppDelegate's own method: another class in the file may implement the same callback,
  // and it has no `cioSdkHandler`.
  const match = executableContents
    .slice(body.open + 1, body.close)
    .match(DID_RECEIVE_REMOTE_NOTIFICATION_METHOD_REGEX);
  if (match && match.index !== undefined) {
    // Read the names from the masked text: it has the same offsets, and they are identifiers.
    const [, application, userInfo, completionHandler] = match;
    const insertAt = body.open + 1 + match.index + match[0].length;
    // A body on the signature's line (`{ done(.noData) }`) needs a line break after the guard.
    const lineBreak = /^[ \t]*(\r?\n|$)/.test(content.substring(insertAt)) ? '' : '\n';
    return (
      content.substring(0, insertAt) +
      '\n    // Call CustomerIO SDK handler\n' +
      `    ${backgroundPushGuard(application, userInfo, completionHandler)}` +
      lineBreak +
      content.substring(insertAt)
    );
  }

  const position = body.close;
  return (
    content.substring(0, position) +
    '\n  // Hand Customer.io silent pushes to the Customer.io SDK and every other push to Expo\n' +
    '  public override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {\n' +
    '    // Call CustomerIO SDK handler\n' +
    `    ${backgroundPushGuard('application', 'userInfo', 'completionHandler')}\n` +
    '    super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)\n' +
    '  }\n' +
    content.substring(position)
  );
}

/**
 * Pure string transform: undoes {@link addBackgroundPushHandling} when the option is turned off,
 * because the regenerated handler no longer has the method the AppDelegate would call. Removes only
 * the exact generated text; returns `content` unchanged when there is none.
 */
export function removeBackgroundPushHandling(content: string): string {
  const executableContents = maskSwiftNonCode(content);
  if (!BACKGROUND_PUSH_CALL_REGEX.test(executableContents)) {
    return content;
  }
  const removeExecutable = (source: string, pattern: RegExp) => {
    const executable = maskSwiftNonCode(source);
    return source.replace(pattern, (match: string, offset: number) =>
      BACKGROUND_PUSH_CALL_REGEX.test(executable.slice(offset, offset + match.length))
        ? ''
        : match
    );
  };
  // Whole-method shape first: it contains the guard's text.
  const next = removeExecutable(
    removeExecutable(content, BACKGROUND_PUSH_METHOD_REGEX),
    BACKGROUND_PUSH_GUARD_REGEX
  );
  if (BACKGROUND_PUSH_CALL_REGEX.test(maskSwiftNonCode(next))) {
    logger.warn(
      'backgroundPush is off, but AppDelegate still calls cioSdkHandler for didReceiveRemoteNotification in code the plugin did not generate. Remove that call, or run `npx expo prebuild --clean --platform ios`.'
    );
  }
  return next;
}

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
