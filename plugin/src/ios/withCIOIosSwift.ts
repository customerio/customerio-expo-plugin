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
  CIO_NATIVE_SDK_INITIALIZE_CALL,
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
import { isFcmPushProvider } from './utils';

// Constants
const CIO_SDK_APP_DELEGATE_HANDLER_CLASS = 'CioSdkAppDelegateHandler';
const CIO_SDK_APP_DELEGATE_HANDLER_FILENAME = `${CIO_SDK_APP_DELEGATE_HANDLER_CLASS}.swift`;

/**
 * Copy and configure the CioSdkAppDelegateHandler.swift file
 */
const copyAndConfigureAppDelegateHandler = (
  config: ExportedConfigWithProps<XcodeProject>,
  sdkConfig?: NativeSDKConfig,
  props?: CustomerIOPluginOptionsIOS,
  location?: CustomerIOPluginLocationOptions,
  geofence?: CustomerIOPluginGeofenceOptions,
): ExportedConfigWithProps<XcodeProject> => {
  // Destination path in the iOS project
  const projectName = config.modRequest.projectName || '';
  if (!projectName) {
    logger.warn(
      'Project name is undefined, cannot copy CustomerIO files'
    );
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
    copyAndConfigureNativeSDKInitializer({ xcodeProject, group, iosProjectRoot, projectName, sdkConfig, location, geofence });

    // Inject auto initialization call before MessagingPush initialization
    handlerFileContent = handlerFileContent.replace(CIO_MESSAGING_PUSH_APP_DELEGATE_INIT_REGEX, CIO_NATIVE_SDK_INITIALIZE_SNIPPET + '$1');
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
      patchNativeSDKInitializer(content, PLATFORM.IOS, sdkConfig, locationOptions, geofenceOptions),
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
) => {
  // First, copy required swift files to iOS folder and add it to Xcode project
  configOuter = withXcodeProject(configOuter, async (config) => {
    return copyAndConfigureAppDelegateHandler(config, sdkConfig, props, location, geofence);
  });

  // Modify the AppDelegate based on configuration
  if (props?.pushNotification) {
    // With push notifications: delegate to CioSdkAppDelegateHandler for both push and auto-init
    return withAppDelegate(configOuter, async (config) => {
      config.modResults.contents = modifyAppDelegateForPushHandler(
        config.modResults.contents,
        props
      );
      return config;
    });
  } else if (sdkConfig || liveNotificationsEnabled) {
    // Without push notifications: inject auto initialization directly, plus the Live Activity tap
    // route when the feature is on. `CioSdkAppDelegateHandler` is not an option here — it imports
    // the push module, which this configuration does not install — so the tap goes straight to the
    // Live Activities module instead.
    return withAppDelegate(configOuter, async (config) => {
      let next = config.modResults.contents;
      if (sdkConfig) {
        next = modifyAppDelegateForNativeSDKInitializer(next);
      }
      if (liveNotificationsEnabled) {
        next = modifyAppDelegateForLiveActivityUrl(next);
      }
      config.modResults.contents = next;
      return config;
    });
  } else {
    return configOuter;
  }
};

/**
 * Pure string transform: produces the Swift AppDelegate contents wired to delegate to
 * `CioSdkAppDelegateHandler` for both push notifications and (when configured) auto-init.
 * Idempotent — returns `contents` unchanged when the handler is already present.
 */
export function modifyAppDelegateForPushHandler(
  contents: string,
  props: CustomerIOPluginOptionsIOS
): string {
  if (contents.includes(CIO_SDK_APP_DELEGATE_HANDLER_CLASS)) {
    logger.info(
      'CustomerIO Swift AppDelegate changes already exist. Adding anything newer...'
    );
    // Don't return the file untouched: an AppDelegate integrated by an earlier plugin version has
    // the handler but not the Live Activity tap route, and skipping outright leaves every upgraded
    // app without it. `addOpenURLHandling` is idempotent, so re-running it is safe.
    return addOpenURLHandling(contents);
  }

  let next = addHandlerPropertyDeclaration(contents);
  next = modifyDidFinishLaunchingWithOptions(
    next,
    `  cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)\n\n    `
  );
  next = addDidRegisterForRemoteNotificationsWithDeviceToken(next);
  next = addDidFailToRegisterForRemoteNotificationsWithError(next);
  next = addOpenURLHandling(next);

  if (props.pushNotification?.handleDeeplinkInKilledState === true) {
    next = addHandleDeeplinkInKilledState(next);
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
export function modifyAppDelegateForLiveActivityUrl(contents: string): string {
  if (contents.includes(LIVE_ACTIVITY_URL_CALL) || hasCioOpenUrlHandling(contents)) {
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
export function modifyAppDelegateForNativeSDKInitializer(contents: string): string {
  if (contents.includes(CIO_NATIVE_SDK_INITIALIZE_CALL)) {
    logger.info(
      'CustomerIO Swift AppDelegate changes already exist. Skipping...'
    );
    return contents;
  }

  return modifyDidFinishLaunchingWithOptions(
    contents,
    CIO_NATIVE_SDK_INITIALIZE_SNIPPET,
  );
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
const modifyDidFinishLaunchingWithOptions = (content: string, codeToInject: string): string => {
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
  return (
    contents.includes(`${CIO_OPEN_URL_MARKER}app, open:`) ||
    contents.includes(`${CIO_OPEN_URL_MARKER}application, open:`)
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
 * Leaves the imports alone: they stay valid while the feature is on, and `addSwiftImports` is
 * idempotent.
 */
function removeLiveActivityUrlGuard(contents: string): string {
  if (!contents.includes(LIVE_ACTIVITY_URL_CALL)) {
    return contents;
  }
  // Whole-method shape first: it contains the guard shape's text, so the narrower pattern would
  // otherwise strip the guard and leave an empty method behind.
  return contents
    .replace(LIVE_ACTIVITY_URL_METHOD_REGEX, '')
    .replace(LIVE_ACTIVITY_URL_GUARD_REGEX, '');
}

/**
 * Add Swift imports after the file's last existing import.
 *
 * Matches an optional leading modifier because React Native 0.83 emits `internal import Expo` as the
 * first line of AppDelegate.swift. An expression anchored to a bare `import` at the start of the
 * file silently matches nothing there, which leaves the injected call referencing symbols that were
 * never imported — a failure that only surfaces at compile time.
 */
function addSwiftImports(contents: string, imports: string[]): string {
  const missing = imports.filter((line) => !contents.includes(line));
  if (missing.length === 0) return contents;

  const matches = [...contents.matchAll(/^(?:\w+[ \t]+)?import[ \t]+\S+.*$/gm)];
  if (matches.length === 0) return contents;

  const last = matches[matches.length - 1];
  const insertAt = (last.index ?? 0) + last[0].length;
  return `${contents.slice(0, insertAt)}\n${missing.join('\n')}${contents.slice(insertAt)}`;
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
