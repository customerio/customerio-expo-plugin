import { ConfigPlugin, withAppDelegate } from '@expo/config-plugins';
import { getAppDelegateHeaderFilePath } from '@expo/config-plugins/build/ios/Paths';

import {
  CIO_APPDELEGATEDECLARATION_REGEX,
  CIO_APPDELEGATEHEADER_IMPORT_SNIPPET,
  CIO_APPDELEGATEHEADER_REGEX,
  CIO_APPDELEGATEHEADER_USER_NOTIFICATION_CENTER_SNIPPET,
  CIO_CONFIGURECIOSDKPUSHNOTIFICATION_SNIPPET,
  CIO_CONFIGUREDEEPLINK_KILLEDSTATE_SNIPPET,
  CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_REGEX,
  CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_REGEX,
  CIO_DIDFAILTOREGISTERFORREMOTENOTIFICATIONSWITHERROR_SNIPPET,
  CIO_DIDFINISHLAUNCHINGMETHOD_REGEX,
  CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_REGEX,
  CIO_DIDREGISTERFORREMOTENOTIFICATIONSWITHDEVICETOKEN_SNIPPET,
  CIO_LAUNCHOPTIONS_DEEPLINK_MODIFIEDOPTIONS_REGEX,
  CIO_PUSHNOTIFICATIONHANDLERDECLARATION_SNIPPET,
  CIO_LAUNCHOPTIONS_MODIFIEDOPTIONS_SNIPPET,
  CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_SNIPPET,
  CIO_DEEPLINK_COMMENT_REGEX,
  CIO_INITIALIZECIOSDK_SNIPPET,
} from '../helpers/constants/ios';
import {
  injectCodeBeforeMultiLineRegex,
  injectCodeByLineNumber,
  injectCodeByMultiLineRegex,
  injectCodeByMultiLineRegexAndReplaceLine,
  replaceCodeByRegex,
  matchRegexExists,
} from '../helpers/utils/codeInjection';
import { FileManagement } from '../helpers/utils/fileManagement';
import type { CustomerIOPluginOptionsIOS } from '../types/cio-types';
import { isFcmPushProvider } from './utils';

const addImport = (stringContents: string, appName: string) => {
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
  );

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

const addInitializeNativeCioSdk = (stringContents: string) => {
  stringContents = injectCodeBeforeMultiLineRegex(
    stringContents,
    CIO_DIDFINISHLAUNCHINGMETHOD_REGEX,
    CIO_INITIALIZECIOSDK_SNIPPET
  );

  return stringContents;
};

const addHandleDeeplinkInKilledStateConfiguration = (
  stringContents: string,
  regex: RegExp
) => {
  stringContents = injectCodeBeforeMultiLineRegex(
    stringContents,
    regex,
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

// Adds required import for Expo Notifications package in AppDelegate.
// Required to call functions from the package.
const addExpoNotificationsHeaderModification = (stringContents: string) => {
  stringContents = injectCodeByLineNumber(
    stringContents,
    0,
    `
#if __has_include(<EXNotifications/EXNotificationCenterDelegate.h>)
#import <EXNotifications/EXNotificationCenterDelegate.h>
#endif
`
  );

  return stringContents;
};

const addFirebaseDelegateForwardDeclarationIfNeeded = (stringContents: string) => {
  stringContents = injectCodeByLineNumber(
    stringContents,
    0,
    '@protocol FIRMessagingDelegate;'
  );

  return stringContents;
};

const addAppdelegateHeaderModification = (stringContents: string) => {
  // Add UNUserNotificationCenterDelegate if needed
  stringContents = stringContents.replace(
    CIO_APPDELEGATEHEADER_REGEX,
    (match, interfaceDeclaration, _groupedDelegates, existingDelegates) => {
      if (
        existingDelegates &&
        existingDelegates.includes(
          CIO_APPDELEGATEHEADER_USER_NOTIFICATION_CENTER_SNIPPET
        )
      ) {
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
  // Find if the deep link code snippet is already present
  if (matchRegexExists(stringContents, CIO_DEEPLINK_COMMENT_REGEX)) {
    return stringContents;
  }

  // Check if the app delegate is using RCTBridge or LaunchOptions
  let snippet = undefined;
  let regex = CIO_LAUNCHOPTIONS_DEEPLINK_MODIFIEDOPTIONS_REGEX;
  if (
    matchRegexExists(
      stringContents,
      CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_REGEX
    )
  ) {
    snippet = CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_SNIPPET;
    regex = CIO_RCTBRIDGE_DEEPLINK_MODIFIEDOPTIONS_REGEX;
  } else if (
    matchRegexExists(
      stringContents,
      CIO_LAUNCHOPTIONS_DEEPLINK_MODIFIEDOPTIONS_REGEX
    )
  ) {
    snippet = CIO_LAUNCHOPTIONS_MODIFIEDOPTIONS_SNIPPET;
  }
  // Add code only if the app delegate is using RCTBridge or LaunchOptions
  if (snippet !== undefined) {
    stringContents = addHandleDeeplinkInKilledStateConfiguration(
      stringContents,
      regex
    );
    stringContents = replaceCodeByRegex(stringContents, regex, snippet);
  }
  return stringContents;
};

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
        props.pushNotification?.disableNotificationRegistration !== undefined &&
        props.pushNotification?.disableNotificationRegistration === false
      ) {
        stringContents = addNotificationConfiguration(stringContents);
      }

      stringContents = addInitializeNativeCioSdk(stringContents);

      if (
        props.pushNotification?.handleDeeplinkInKilledState !== undefined &&
        props.pushNotification?.handleDeeplinkInKilledState === true
      ) {
        stringContents = addHandleDeeplinkInKilledState(stringContents);
      }

      stringContents =
        addDidFailToRegisterForRemoteNotificationsWithError(stringContents);
      stringContents =
        addDidRegisterForRemoteNotificationsWithDeviceToken(stringContents);

      if (isFcmPushProvider(props)) {
        stringContents = addFirebaseDelegateForwardDeclarationIfNeeded(stringContents);
      }

      stringContents = addExpoNotificationsHeaderModification(stringContents);

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
