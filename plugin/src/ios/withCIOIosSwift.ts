import type {
  ConfigPlugin,
  ExportedConfigWithProps,
  XcodeProject,
} from '@expo/config-plugins';
import { withAppDelegate, withXcodeProject } from '@expo/config-plugins';
import path from 'path';
import {
  CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SWIFT_SNIPPET,
  CIO_REGISTER_PUSHNOTIFICATION_SNIPPET_v2,
  CIO_REGISTER_PUSH_NOTIFICATION_PLACEHOLDER,
  LOCAL_PATH_TO_CIO_NSE_FILES,
} from '../helpers/constants/ios';
import { replaceCodeByRegex } from '../helpers/utils/codeInjection';
import { FileManagement } from '../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { isFcmPushProvider } from './utils';

// Constants
const CIO_SDK_APP_DELEGATE_HANDLER_CLASS = 'CioSdkAppDelegateHandler';
const CIO_SDK_APP_DELEGATE_HANDLER_FILENAME = `${CIO_SDK_APP_DELEGATE_HANDLER_CLASS}.swift`;

/**
 * Copy and configure the CioSdkAppDelegateHandler.swift file
 */
const copyAndConfigureAppDelegateHandler = (
  config: ExportedConfigWithProps<XcodeProject>,
  props: CustomerIOPluginOptionsIOS
): ExportedConfigWithProps<XcodeProject> => {
  const projectRoot = config.modRequest.projectRoot;
  const iosProjectRoot = path.join(projectRoot, 'ios');
  const useFcm = isFcmPushProvider(props);

  // Source path for the handler file
  const handlerSourcePath = path.join(
    LOCAL_PATH_TO_CIO_NSE_FILES,
    useFcm ? 'fcm' : 'apn',
    CIO_SDK_APP_DELEGATE_HANDLER_FILENAME
  );

  // Destination path in the iOS project
  const projectName = config.modRequest.projectName || '';
  if (!projectName) {
    console.warn(
      'Project name is undefined, cannot copy CioSdkAppDelegateHandler.swift'
    );
    return config;
  }

  const handlerDestPath = path.join(
    iosProjectRoot,
    projectName,
    CIO_SDK_APP_DELEGATE_HANDLER_FILENAME
  );

  FileManagement.copyFile(handlerSourcePath, handlerDestPath);

  // Add the file to the Xcode project
  const xcodeProject = config.modResults;

  // Create a group for CustomerIO files if it doesn't exist
  let group;
  const existingGroup = xcodeProject.pbxGroupByName('CustomerIO');
  if (existingGroup) {
    group = existingGroup;
  } else {
    group = xcodeProject.pbxCreateGroup('CustomerIO');
    const classesKey = xcodeProject.findPBXGroupKey({ name: projectName });
    xcodeProject.addToPbxGroup(group, classesKey);
  }

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

  FileManagement.writeFile(handlerDestPath, handlerFileContent);

  return config;
};

export const withCIOIosSwift: ConfigPlugin<CustomerIOPluginOptionsIOS> = (
  configOuter,
  props
) => {
  // First, copy the CioSdkAppDelegateHandler.swift file to the iOS project and add it to Xcode project
  configOuter = withXcodeProject(configOuter, async (config) => {
    return copyAndConfigureAppDelegateHandler(config, props);
  });

  // Then modify the AppDelegate
  return withAppDelegate(configOuter, async (config) => {
    return modifyAppDelegate(config, props);
  });
};

/**
 * Modify the AppDelegate to integrate with Customer.io SDK
 */
const modifyAppDelegate = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  props: CustomerIOPluginOptionsIOS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => {
  const appDelegateContent = config.modResults.contents;

  // Check if modifications have already been applied
  if (appDelegateContent.includes(CIO_SDK_APP_DELEGATE_HANDLER_CLASS)) {
    console.log(
      'CustomerIO Swift AppDelegate changes already exist. Skipping...'
    );
    return config;
  }

  // Add the handler property declaration
  let modifiedContent = addHandlerPropertyDeclaration(appDelegateContent);

  // Modify didFinishLaunchingWithOptions to initialize and call the handler
  modifiedContent = modifyDidFinishLaunchingWithOptions(modifiedContent);

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
    console.warn('Could not find AppDelegate class declaration');
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
 * Modify didFinishLaunchingWithOptions to call the handler
 * This adds the handler call before the return statement in didFinishLaunchingWithOptions
 */
const modifyDidFinishLaunchingWithOptions = (content: string): string => {
  // Find the return statement in didFinishLaunchingWithOptions
  // Always look for launchOptions since modifiedLaunchOptions is only set later
  const returnStatementRegex =
    /return\s+super\.application\s*\(\s*application\s*,\s*didFinishLaunchingWithOptions\s*:\s*launchOptions\s*\)/;

  const returnStatementMatch = content.match(returnStatementRegex);

  if (!returnStatementMatch) {
    console.warn(
      'Could not find return statement with super.application in didFinishLaunchingWithOptions'
    );
    return content;
  }

  // Add handler call before the return statement
  const insertPosition = returnStatementMatch.index ?? 0;
  const handlerCallCode = `  cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)\n\n    `;

  return (
    content.substring(0, insertPosition) +
    handlerCallCode +
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
      console.warn('Could not find end of AppDelegate class');
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
      console.warn('Could not find end of AppDelegate class');
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
    console.warn('Could not find return statement with launchOptions');
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
