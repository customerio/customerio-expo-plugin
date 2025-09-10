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
import type { CustomerIOPluginOptionsIOS, NativeSDKConfig } from '../types/cio-types';
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
    });
  } else if (sdkConfig) {
    // Copy only CustomerIOSDKInitializer.swift for auto-init without push notifications
    copyAndConfigureNativeSDKInitializer({
      xcodeProject,
      group,
      iosProjectRoot,
      projectName,
      sdkConfig,
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
}: {
  xcodeProject: XcodeProject;
  group: XcodeProject['pbxCreateGroup'];
  iosProjectRoot: string;
  projectName: string;
  sdkConfig: NativeSDKConfig | undefined;
  props: CustomerIOPluginOptionsIOS;
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

  // Add auto initialization if sdkConfig is provided
  if (sdkConfig) {
    // Also copy CustomerIOSDKInitializer.swift for auto-initialization
    copyAndConfigureNativeSDKInitializer({ xcodeProject, group, iosProjectRoot, projectName, sdkConfig });

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
}: {
  xcodeProject: XcodeProject;
  group: XcodeProject['pbxCreateGroup'];
  iosProjectRoot: string;
  projectName: string;
  sdkConfig: NativeSDKConfig;
}) => {
  const filename = 'CustomerIOSDKInitializer.swift';
  const sourcePath = path.join(getIosNativeFilesPath(), filename);
  // Add the CustomerIOSDKInitializer.swift file to the same Xcode group as CioSdkAppDelegateHandler
  copyFileToXcode({
    xcodeProject,
    iosProjectRoot,
    projectName,
    sourceFilePath: sourcePath,
    targetFileName: filename,
    transform: (content) => patchNativeSDKInitializer(content, PLATFORM.IOS, sdkConfig),
    customerIOGroup: group,
  });
};

export const withCIOIosSwift = (
  configOuter: ExpoConfig,
  sdkConfig?: NativeSDKConfig,
  props?: CustomerIOPluginOptionsIOS,
) => {
  // First, copy required swift files to iOS folder and add it to Xcode project
  configOuter = withXcodeProject(configOuter, async (config) => {
    return copyAndConfigureAppDelegateHandler(config, sdkConfig, props);
  });

  // Modify the AppDelegate based on configuration
  if (props?.pushNotification) {
    // With push notifications: delegate to CioSdkAppDelegateHandler for both push and auto-init
    return withAppDelegate(configOuter, async (config) => {
      return modifyAppDelegateWithPushAppDelegateHandler(config, props);
    });
  } else if (sdkConfig) {
    // Without push notifications: directly inject auto initialization into AppDelegate
    return withAppDelegate(configOuter, async (config) => {
      return modifyAppDelegateWithNativeSDKInitializer(config);
    });
  } else {
    return configOuter;
  }
};

/**
 * Modify the AppDelegate to integrate with Customer.io SDK
 */
const modifyAppDelegateWithPushAppDelegateHandler = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  props: CustomerIOPluginOptionsIOS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => {
  const appDelegateContent = config.modResults.contents;

  // Check if modifications have already been applied
  if (appDelegateContent.includes(CIO_SDK_APP_DELEGATE_HANDLER_CLASS)) {
    logger.info(
      'CustomerIO Swift AppDelegate changes already exist. Skipping...'
    );
    return config;
  }

  // Add the handler property declaration
  let modifiedContent = addHandlerPropertyDeclaration(appDelegateContent);

  // Modify didFinishLaunchingWithOptions to initialize and call the handler
  modifiedContent = modifyDidFinishLaunchingWithOptions(
    modifiedContent,
    `  cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)\n\n    `
  );

  // Add didRegisterForRemoteNotificationsWithDeviceToken implementation
  modifiedContent =
    addDidRegisterForRemoteNotificationsWithDeviceToken(modifiedContent);

  // Add didFailToRegisterForRemoteNotificationsWithError implementation
  modifiedContent =
    addDidFailToRegisterForRemoteNotificationsWithError(modifiedContent);

  // Add deep link handling for killed state if enabled
  if (props.pushNotification?.handleDeeplinkInKilledState === true) {
    modifiedContent = addHandleDeeplinkInKilledState(modifiedContent);
  }

  config.modResults.contents = modifiedContent;
  return config;
};

/**
 * Modify the AppDelegate to integrate with Customer.io SDK
 */
const modifyAppDelegateWithNativeSDKInitializer = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => {
  const appDelegateContent = config.modResults.contents;

  // Check if modifications have already been applied
  if (appDelegateContent.includes(CIO_NATIVE_SDK_INITIALIZE_CALL)) {
    logger.info(
      'CustomerIO Swift AppDelegate changes already exist. Skipping...'
    );
    return config;
  }

  // Modify didFinishLaunchingWithOptions to initialize and call the handler
  const modifiedContent = modifyDidFinishLaunchingWithOptions(
    appDelegateContent,
    CIO_NATIVE_SDK_INITIALIZE_SNIPPET,
  );

  config.modResults.contents = modifiedContent;
  return config;
};

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
 * This replaces the return statement with deep link handling code
 * and a modified return statement that uses modifiedLaunchOptions
 */
const addHandleDeeplinkInKilledState = (content: string): string => {
  // Check if deep link code snippet is already present
  const deepLinkMarker = 'Deep link workaround for app killed state start';
  if (content.includes(deepLinkMarker)) {
    return content;
  }

  // Find the return statement with launchOptions
  const returnStatementRegex =
    /return\s+super\.application\s*\(\s*application\s*,\s*didFinishLaunchingWithOptions\s*:\s*launchOptions\s*\)/;
  const returnStatementMatch = content.match(returnStatementRegex);

  if (!returnStatementMatch) {
    logger.warn('Could not find return statement with launchOptions');
    return content;
  }

  // Create the replacement code with deep link handling and modified return statement
  const modifiedReturnStatement =
    'return super.application(application, didFinishLaunchingWithOptions: modifiedLaunchOptions)';
  const replacementCode =
    CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SWIFT_SNIPPET +
    '\n\n    ' +
    modifiedReturnStatement;

  // Replace the return statement with deep link handling code and modified return statement
  return content.replace(returnStatementRegex, replacementCode);
};
