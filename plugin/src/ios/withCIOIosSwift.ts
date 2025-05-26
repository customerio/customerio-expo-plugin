import {
  ConfigPlugin,
  withAppDelegate,
  withXcodeProject,
} from '@expo/config-plugins';
import path from 'path';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { FileManagement } from '../helpers/utils/fileManagement';
import {
  LOCAL_PATH_TO_CIO_NSE_FILES,
  CIO_REGISTER_PUSHNOTIFICATION_SNIPPET_v2,
  CIO_REGISTER_PUSH_NOTIFICATION_PLACEHOLDER,
  CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SWIFT_SNIPPET,
} from '../helpers/constants/ios';
import { replaceCodeByRegex } from '../helpers/utils/codeInjection';
import { isFcmPushProvider } from './utils';

export const withCIOIosSwift: ConfigPlugin<CustomerIOPluginOptionsIOS> = (
  configOuter,
  props
) => {
  console.log(`props: ${JSON.stringify(props)}`);
  // First, copy the CioSdkAppDelegateHandler.swift file to the iOS project and add it to Xcode project
  configOuter = withXcodeProject(configOuter, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const iosProjectRoot = path.join(projectRoot, 'ios');
    const useFcm = isFcmPushProvider(props);

    // Source path for the handler file
    const handlerSourcePath = path.join(
      LOCAL_PATH_TO_CIO_NSE_FILES,
      useFcm ? 'fcm' : 'apn',
      'CioSdkAppDelegateHandler.swift'
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
      'CioSdkAppDelegateHandler.swift'
    );

    console.log(`Copying CioSdkAppDelegateHandler.swift to iOS project...`);
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
      `${projectName}/CioSdkAppDelegateHandler.swift`,
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
  });

  // Then modify the AppDelegate
  return withAppDelegate(configOuter, async (config) => {
    const appDelegateContent = config.modResults.contents;

    // Check if modifications have already been applied
    if (appDelegateContent.includes('CioSdkAppDelegateHandler')) {
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
  });
};

// Add handler property declaration to the AppDelegate class
const addHandlerPropertyDeclaration = (content: string): string => {
  // Look for the AppDelegate class declaration
  const classDeclarationRegex = /class\s+AppDelegate\s*:\s*.*\s*{/;
  const match = content.match(classDeclarationRegex);

  if (!match) {
    console.warn('Could not find AppDelegate class declaration');
    return content;
  }

  const position = match.index! + match[0].length;
  return (
    content.substring(0, position) +
    '\n    let cioSdkHandler = CioSdkAppDelegateHandler()\n' +
    content.substring(position)
  );
};

// Modify didFinishLaunchingWithOptions to call the handler
const modifyDidFinishLaunchingWithOptions = (content: string): string => {
  // Find the return statement in didFinishLaunchingWithOptions
  // Always look for launchOptions since modifiedLaunchOptions is only set later
  const returnRegex = /return\s+super\.application\s*\(\s*application\s*,\s*didFinishLaunchingWithOptions\s*:\s*launchOptions\s*\)/;
  
  const match = content.match(returnRegex);

  if (!match) {
    console.warn(
      'Could not find return statement with super.application in didFinishLaunchingWithOptions'
    );
    return content;
  }

  // Add handler call before the return statement
  const position = match.index!;
  return (
    content.substring(0, position) +
    `    cioSdkHandler.application(application, didFinishLaunchingWithOptions: launchOptions)\n\n    ` +
    content.substring(position)
  );
};

// Add didRegisterForRemoteNotificationsWithDeviceToken implementation
const addDidRegisterForRemoteNotificationsWithDeviceToken = (
  content: string
): string => {
  // Check if method already exists
  if (
    content.includes(
      'func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken:'
    )
  ) {
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
    const position = classEndMatch.index!;
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

// Add didFailToRegisterForRemoteNotificationsWithError implementation
const addDidFailToRegisterForRemoteNotificationsWithError = (
  content: string
): string => {
  // Check if method already exists
  if (
    content.includes(
      'func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error:'
    )
  ) {
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
    const position = classEndMatch.index!;
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

// Add deep link handling for killed state
const addHandleDeeplinkInKilledState = (content: string): string => {
  // Check if deep link code snippet is already present
  if (content.includes("Deep link workaround for app killed state start")) {
    return content;
  }

  // Find the return statement with launchOptions
  const returnRegex = /return\s+super\.application\s*\(\s*application\s*,\s*didFinishLaunchingWithOptions\s*:\s*launchOptions\s*\)/;
  const match = content.match(returnRegex);
  
  if (!match) {
    console.warn("Could not find return statement with launchOptions");
    return content;
  }
  
  // Replace the return statement with deep link handling code and modified return statement
  return content.replace(
    returnRegex,
    CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SWIFT_SNIPPET + "\n\n    return super.application(application, didFinishLaunchingWithOptions: modifiedLaunchOptions)"
  );
};
