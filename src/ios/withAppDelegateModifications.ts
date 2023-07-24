import { ConfigPlugin, withAppDelegate } from '@expo/config-plugins';
import { getAppDelegateHeaderFilePath } from '@expo/config-plugins/build/ios/Paths';
const Constants = require("expo-constants");

import {
  CIO_APPDELEGATEDECLARATION_REGEX,
  CIO_APPDELEGATEHEADER_IMPORT_SNIPPET,
  CIO_APPDELEGATEHEADER_REGEX,
  CIO_APPDELEGATEHEADER_USER_NOTIFICATION_CENTER_SNIPPET,
  CIO_CONFIGURECIOSDKPUSHNOTIFICATION_SNIPPET,
  CIO_CONFIGURECIOSDKUSERNOTIFICATIONCENTER_SNIPPET,
  CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SNIPPET,
  CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERRORFULL_REGEX,
  CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_REGEX,
  CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_SNIPPET,
  CIO_DIDFINISHLAUNCHINGMETHOD_REGEX,
  CIO_DIDRECEIVENOTIFICATIONRESPONSEHANDLER_SNIPPET,
  CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_REGEX,
  CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_SNIPPET,
  CIO_PUSHNOTIFICATIONHANDLERDECLARATION_SNIPPET,
  CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_REGEX,
  CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_SNIPPET,
  CIO_WILLPRESENTNOTIFICATIONHANDLER_SNIPPET,
} from '../helpers/constants/ios';
import {
  injectCodeBeforeMultiLineRegex,
  injectCodeByLineNumber,
  injectCodeByMultiLineRegex,
  injectCodeByMultiLineRegexAndReplaceLine,
  replaceCodeByRegex,
} from '../helpers/utils/codeInjection';
import { FileManagement } from '../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';

const pushCodeSnippets = [
  CIO_DIDRECEIVENOTIFICATIONRESPONSEHANDLER_SNIPPET,
  CIO_WILLPRESENTNOTIFICATIONHANDLER_SNIPPET,
];

const additionalMethodsForPushNotifications = `${pushCodeSnippets.join(
  '\n'
)}\n`; // Join newlines and ensure a newline at the end.

const addImport = (stringContents: string, appName: string) => {
  console.log(`Version ${Constants.expoVersion}`);

  const importRegex = /^(#import .*)\n/gm;
  const addedImport = getImportSnippet(appName);

  const match = stringContents.match(importRegex);
  let endOfMatchIndex: number;
  if (!match || match.index === undefined) {
    // No imports found, just add to start of file:
    endOfMatchIndex = 0;
  } else {
    // Add after first import:
    endOfMatchIndex = match.index + match[0].length;
  }

  stringContents = injectCodeByLineNumber(
    stringContents,
    endOfMatchIndex,
    addedImport
  ).join('\n');

  return stringContents;
};

const addNotificationHandlerDeclaration = (stringContents: string) => {
  stringContents = injectCodeByMultiLineRegex(
    stringContents,
    CIO_APPDELEGATEDECLARATION_REGEX,
    CIO_PUSHNOTIFICATIONHANDLERDECLARATION_SNIPPET
  );

  return stringContents;
};

const addNotificationConfiguration = (stringContents: string) => {
  stringContents = injectCodeBeforeMultiLineRegex(
    stringContents,
    CIO_DIDFINISHLAUNCHINGMETHOD_REGEX,
    CIO_CONFIGURECIOSDKPUSHNOTIFICATION_SNIPPET
  );

  return stringContents;
};

const addUserNotificationCenterConfiguration = (stringContents: string) => {
  stringContents = injectCodeBeforeMultiLineRegex(
    stringContents,
    CIO_DIDFINISHLAUNCHINGMETHOD_REGEX,
    CIO_CONFIGURECIOSDKUSERNOTIFICATIONCENTER_SNIPPET
  );

  return stringContents;
};

const addHandleDeeplinkInKilledStateConfiguration = (stringContents: string) => {
  stringContents = injectCodeBeforeMultiLineRegex(
    stringContents,
    CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_REGEX,
    CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SNIPPET
  );

  return stringContents;
};

const addDidFailToRegisterForRemoteNotificationsWithError = (
  stringContents: string
) => {
  stringContents = injectCodeByMultiLineRegexAndReplaceLine(
    stringContents,
    CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_REGEX,
    CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_SNIPPET
  );

  return stringContents;
};

const addDidRegisterForRemoteNotificationsWithDeviceToken = (
  stringContents: string
) => {
  stringContents = injectCodeByMultiLineRegexAndReplaceLine(
    stringContents,
    CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_REGEX,
    CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_SNIPPET
  );

  return stringContents;
};

const addAdditionalMethodsForPushNotifications = (stringContents: string) => {
  stringContents = injectCodeByMultiLineRegex(
    stringContents,
    CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERRORFULL_REGEX,
    additionalMethodsForPushNotifications
  );

  return stringContents;
};

const addAppdelegateHeaderModification = (stringContents: string) => {
  // Add UNUserNotificationCenterDelegate if needed
  stringContents = stringContents.replace(
    CIO_APPDELEGATEHEADER_REGEX,
    (match, interfaceDeclaration, _groupedDelegates, existingDelegates) => {
      if (existingDelegates && existingDelegates.includes(CIO_APPDELEGATEHEADER_USER_NOTIFICATION_CENTER_SNIPPET)) {
        // The AppDelegate declaration already includes UNUserNotificationCenterDelegate, so we don't need to modify it
        return match;
      } else if (existingDelegates) {
        // Other delegates exist, append ours
        return `${CIO_APPDELEGATEHEADER_IMPORT_SNIPPET}
${interfaceDeclaration}<${existingDelegates}, ${CIO_APPDELEGATEHEADER_USER_NOTIFICATION_CENTER_SNIPPET}>
`;
      } else {
        // No delegates exist, add ours
        return `${CIO_APPDELEGATEHEADER_IMPORT_SNIPPET}
${interfaceDeclaration.trim()} <${CIO_APPDELEGATEHEADER_USER_NOTIFICATION_CENTER_SNIPPET}>
`;
      }
    }
  );

  return stringContents;
};

const addHandleDeeplinkInKilledState = (stringContents: string) => {
  stringContents = addHandleDeeplinkInKilledStateConfiguration(stringContents)
  stringContents = replaceCodeByRegex(stringContents, CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_REGEX, CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_SNIPPET);
  return stringContents
}
export const withAppDelegateModifications: ConfigPlugin<
  CustomerIOPluginOptionsIOS
> = (configOuter, props) => {
  return withAppDelegate(configOuter, async (config) => {
    let stringContents = config.modResults.contents;
    const regex = new RegExp(
      `#import <${config.modRequest.projectName}-Swift.h>`
    );
    const match = stringContents.match(regex);

    if (!match) {
      const headerPath = getAppDelegateHeaderFilePath(
        config.modRequest.projectRoot
      );
      let headerContent = await FileManagement.read(headerPath);
      headerContent = addAppdelegateHeaderModification(headerContent);
      FileManagement.write(headerPath, headerContent);

      stringContents = addImport(
        stringContents,
        config.modRequest.projectName as string
      );
      stringContents = addNotificationHandlerDeclaration(stringContents);

      // any other value would be treated as true, it has to be explicitly false to disable
      if (
        props.disableNotificationRegistration !== undefined &&
        props.disableNotificationRegistration === false
      ) {
        stringContents = addNotificationConfiguration(stringContents);
      }
      if (
        props.handleNotificationClick !== undefined &&
        props.handleNotificationClick === true
      ) {
        stringContents = addUserNotificationCenterConfiguration(stringContents);
      }

      if (
        props.handleDeeplinkInKilledState !== undefined &&
        props.handleDeeplinkInKilledState === true
      ) {
        stringContents = addHandleDeeplinkInKilledState(stringContents);
      }
  
      stringContents = addAdditionalMethodsForPushNotifications(stringContents);
      stringContents =
        addDidFailToRegisterForRemoteNotificationsWithError(stringContents);
      stringContents =
        addDidRegisterForRemoteNotificationsWithDeviceToken(stringContents);

      config.modResults.contents = stringContents;
    } else {
      console.log('Customerio AppDelegate changes already exist. Skipping...');
    }

    return config;
  });
};
function getImportSnippet(appName: string) {
  return `
// Add swift bridge imports
#import <ExpoModulesCore-Swift.h>
#import <${appName}-Swift.h>
  `;
}
